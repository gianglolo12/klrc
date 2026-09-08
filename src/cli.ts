#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { emitKeypressEvents } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { analyze } from './audio/analyze.ts'
import type { Spectrum } from './audio/spectrum-types.ts'
import type { Player } from './audio/player.ts'
import { pickPlayer as choosePlayer, type PlayerChoice } from './audio/pick-player.ts'
import { doctor } from './doctor.ts'
import { alignWords, getLyricsFor, LyricsNotFoundError } from './lyrics/index.ts'
import { openInNewTerminal, shellQuote } from './open-terminal.ts'
import { lrcPath, loadLast, saveLast, saveOffset } from './lyrics/store.ts'
import { resolve } from './resolver/index.ts'
import type { Track } from './resolver/types.ts'
import type { Lyrics } from './lyrics/types.ts'
import { Renderer } from './ui/renderer.ts'
import type { ViewState } from './ui/frame.ts'
import { formatTime } from './ui/progress.ts'
import { SHOW_CURSOR } from './ui/theme.ts'

const VERSION = '0.1.0'
const SEEK_STEP_MS = 5000
const SYNC_STEP_MS = 250

const HELP = `klrc ${VERSION} — karaoke lyrics in your terminal

Usage:
  klrc <youtube-url | audio-file>     play with scrolling karaoke lyrics
  klrc --open <youtube-url | file>    play it in a new Terminal window
  klrc path --last                    print the .lrc file of the last song
  klrc path <input>                   print the .lrc file for a song
  klrc doctor                         check this machine's setup

Options:
  --player <mpv|afplay>   choose the audio player (default: best available)
  --title <name>          override the track title used for the lyrics lookup
  --artist <name>         override the artist used for the lyrics lookup
  --no-audio              show lyrics on a timer without playing audio
  --open                  open a new Terminal window instead of playing here
  -h, --help              show this help
  -v, --version           show the version

Keys while playing:
  space   pause / resume
  <- ->   seek 5s (only with mpv)
  [ ]     nudge lyrics timing by 0.25s, remembered for next time
  q       quit
`

type Options = {
  player?: string
  title?: string
  artist?: string
  noAudio: boolean
}

function log(msg: string): void {
  process.stderr.write(`${msg}\n`)
}

/** Chế độ không có TTY: in lời tĩnh để Claude đọc được mà không ngập escape code. */
function printStatic(track: Track, lyrics: Lyrics): void {
  const header = track.artist ? `${track.title} — ${track.artist}` : track.title
  process.stdout.write(`${header}\n\n`)
  if (!lyrics.hasTiming) {
    process.stdout.write('(no timing for this song — lyrics only)\n\n')
  }
  for (const line of lyrics.lines) {
    const stamp = lyrics.hasTiming ? `[${formatTime(line.startMs)}] ` : ''
    process.stdout.write(`${stamp}${line.text}\n`)
  }
}

/** Không phát nhạc: đồng hồ tự chạy, để xem lời khi nhạc bật ở chỗ khác. */
class TimerPlayer implements Player {
  readonly canSeek = true
  readonly label = 'timer'
  private startedAt = 0
  private pausedAt: number | null = null
  private pausedTotal = 0
  private base = 0

  async play(): Promise<void> {
    this.startedAt = Date.now()
  }
  get positionMs(): number {
    if (this.startedAt === 0) return this.base
    const now = this.pausedAt ?? Date.now()
    return Math.max(this.base + now - this.startedAt - this.pausedTotal, 0)
  }
  get isPaused(): boolean {
    return this.pausedAt !== null
  }
  pause(): void {
    if (this.pausedAt === null) this.pausedAt = Date.now()
  }
  resume(): void {
    if (this.pausedAt === null) return
    this.pausedTotal += Date.now() - this.pausedAt
    this.pausedAt = null
  }
  seek(ms: number): void {
    this.base = Math.max(ms, 0)
    this.startedAt = Date.now()
    this.pausedTotal = 0
    if (this.pausedAt !== null) this.pausedAt = Date.now()
  }
  stop(): void {}
  onEnd(_cb: () => void): void {}
}

async function pickPlayer(track: Track, opts: Options): Promise<Player> {
  if (opts.noAudio) return new TimerPlayer()
  return choosePlayer(track.audioPath, opts.player as PlayerChoice | undefined)
}

function reportLyricsFailure(err: LyricsNotFoundError, track: Track): void {
  log(`\nNo lyrics found for "${err.title}"${err.artist ? ` by ${err.artist}` : ''}.`)
  log('')
  log('Things that usually help:')
  log(`  • the title may be off — retry with the real one:`)
  log(`      klrc --title "<song>" --artist "<artist>" <input>`)
  log(`  • ask Claude to sort it out:  /karaoke fix`)
  log(`  • lrclib.net may simply not have this song yet; you can contribute it.`)
  log('')
  log(`Lyrics file would live at: ${lrcPath(track.sourceId)}`)
}

async function play(input: string, opts: Options): Promise<number> {
  const track = await resolve(input)
  if (opts.title) track.title = opts.title
  if (opts.artist) track.artist = opts.artist

  // Hai viec cho khac nhau: tra loi cho mang, phan tich pho cho CPU. Chay song
  // song nen thoi gian khoi dong bang cai cham hon, khong phai tong hai cai.
  const [lyricsResult, spectrumResult] = await Promise.allSettled([
    getLyricsFor(track),
    analyze(track.audioPath, track.sourceId),
  ])

  if (lyricsResult.status === 'rejected') {
    const err = lyricsResult.reason
    if (err instanceof LyricsNotFoundError) {
      reportLyricsFailure(err, track)
      return 1
    }
    throw err
  }
  const lyrics: Lyrics = lyricsResult.value

  // Pho nhac vua la hieu ung, vua la du lieu de do doan co tieng hat. That bai
  // thi bo hieu ung va roi ve rai chu deu ca dong, dung bo bai hat.
  const spectrum: Spectrum | null =
    spectrumResult.status === 'fulfilled' ? spectrumResult.value : null

  alignWords(lyrics, spectrum)

  saveLast(track.sourceId)

  if (!process.stdout.isTTY) {
    printStatic(track, lyrics)
    return 0
  }

  const player = await pickPlayer(track, opts)
  const state: ViewState = {
    title: track.title,
    artist: track.artist,
    lyrics,
    spectrum,
    durationMs: track.durationMs,
    playerLabel: player.label,
    canSeek: player.canSeek,
    offsetMs: lyrics.offsetMs,
    paused: false,
  }

  const renderer = new Renderer(state, player, process.stdout)

  let cleanedUp = false
  const cleanup = (): void => {
    if (cleanedUp) return
    cleanedUp = true
    renderer.stop()
    player.stop()
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdout.write(SHOW_CURSOR)
  }

  // Không dọn dẹp là để lại terminal mất con trỏ và ở raw mode — hỏng shell của
  // người dùng sau khi thoát, nên phải bắt mọi đường ra.
  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(143)
  })

  const done = new Promise<void>((resolveDone) => {
    player.onEnd(() => resolveDone())

    if (process.stdin.isTTY) {
      emitKeypressEvents(process.stdin)
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.on('keypress', (_str, key: { name?: string; ctrl?: boolean }) => {
        if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
          resolveDone()
          return
        }
        if (key.name === 'space') {
          if (player.isPaused) player.resume()
          else player.pause()
          return
        }
        if (key.name === 'right' && player.canSeek) {
          player.seek(player.positionMs + SEEK_STEP_MS)
          return
        }
        if (key.name === 'left' && player.canSeek) {
          player.seek(Math.max(player.positionMs - SEEK_STEP_MS, 0))
          return
        }
        // `[` lời chạy sớm hơn, `]` lời chạy muộn hơn. Lưu lại ngay để lần sau
        // mở cùng bài là đúng nhịp, không phải canh lại.
        if (key.name === '[' || key.name === ']') {
          state.offsetMs += key.name === '[' ? -SYNC_STEP_MS : SYNC_STEP_MS
          saveOffset(track.sourceId, state.offsetMs)
        }
      })
    }
  })

  renderer.start()
  await player.play()
  await done
  cleanup()
  return 0
}

async function pathCommand(rest: string[], last: boolean): Promise<number> {
  if (last) {
    const id = loadLast()
    if (!id) {
      log('No song played yet, so there is no lyrics file to point at.')
      return 1
    }
    process.stdout.write(`${lrcPath(id)}\n`)
    return 0
  }
  if (rest.length === 0) {
    log('Usage: klrc path --last | klrc path <youtube-url | audio-file>')
    return 1
  }
  const track = await resolve(rest[0])
  process.stdout.write(`${lrcPath(track.sourceId)}\n`)
  return 0
}

export async function main(argv: string[]): Promise<number> {
  if (process.platform !== 'darwin') {
    log('klrc currently supports macOS only.')
    return 1
  }

  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        player: { type: 'string' },
        title: { type: 'string' },
        artist: { type: 'string' },
        'no-audio': { type: 'boolean', default: false },
        open: { type: 'boolean', default: false },
        last: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    })
  } catch (err) {
    log(err instanceof Error ? err.message : String(err))
    log('Run `klrc --help` for usage.')
    return 1
  }

  const { values, positionals } = parsed

  if (values.help) {
    process.stdout.write(HELP)
    return 0
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`)
    return 0
  }

  if (values.player && values.player !== 'mpv' && values.player !== 'afplay') {
    log(`Unknown player "${values.player}". Use mpv or afplay.`)
    return 1
  }

  const opts: Options = {
    player: values.player,
    title: values.title,
    artist: values.artist,
    noAudio: values['no-audio'] === true,
  }

  const [command, ...rest] = positionals

  try {
    if (!command) {
      process.stdout.write(HELP)
      return 1
    }
    if (command === 'path') return await pathCommand(rest, values.last === true)
    if (command === 'doctor') {
      process.stdout.write(await doctor())
      return 0
    }

    // Claude Code goi duong nay: karaoke can TTY that, nen mo cua so rieng roi
    // tra quyen dieu khien lai ngay.
    if (values.open === true) {
      const flags = [
        opts.title ? `--title ${shellQuote(opts.title)}` : '',
        opts.artist ? `--artist ${shellQuote(opts.artist)}` : '',
        opts.player ? `--player ${opts.player}` : '',
        opts.noAudio ? '--no-audio' : '',
      ].filter(Boolean).join(' ')
      // Goi chinh ban dang chay, khong phai `npx klrc`: npx keo ban tu registry
      // nen cua so moi se chet khi may chua co mang, chua cai, hoac dang chay
      // mot ban khac ban nay.
      const self = process.argv[1] ?? 'klrc'
      const cmd = `${shellQuote(self)} ${flags} ${shellQuote(command)}`.replace(/\s+/g, ' ')
      await openInNewTerminal(cmd)
      process.stdout.write('Opened karaoke in a new Terminal window.\n')
      return 0
    }

    return await play(command, opts)
  } catch (err) {
    log(err instanceof Error ? err.message : String(err))
    return 1
  }
}

function runningAsEntry(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (runningAsEntry()) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
