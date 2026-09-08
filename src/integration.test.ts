import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.KLRC_HOME = mkdtempSync(join(tmpdir(), 'klrc-int-'))

const { resolveLocal } = await import('./resolver/local.ts')
const { alignWords, getLyricsFor } = await import('./lyrics/index.ts')
const { saveLrc } = await import('./lyrics/store.ts')
const { AfplayPlayer } = await import('./audio/afplay-player.ts')
const { Renderer } = await import('./ui/renderer.ts')
const { stripAnsi } = await import('./ui/theme.ts')
const { interpolateWords } = await import('./lyrics/interpolate.ts')

const audio = fileURLToPath(new URL('./resolver/fixtures/tone5s.mp3', import.meta.url))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const LRC = `[00:00.50] first line of the tone
[00:01.50] second line arrives
[00:02.50] third line now
[00:03.50] and the last one`

/**
 * Tuyến đầy đủ với player phát tiếng thật: file → lời từ cache → khung hình
 * tiến triển theo thời gian. Đây là mảnh cuối mà FakePlayer không kiểm được —
 * rằng vị trí phát thật cũng đẩy được animation.
 */
test('đầu-cuối: file local + lời trong cache + player thật đẩy được animation', async () => {
  const track = await resolveLocal(audio)
  saveLrc(track.sourceId, LRC)

  const lyrics = await getLyricsFor(track)
  assert.equal(lyrics.hasTiming, true)
  assert.equal(lyrics.lines.length, 4)
  assert.equal(lyrics.lines[0].words.length, 0, 'getLyricsFor chưa rải timing từng chữ')

  alignWords(lyrics, null)
  assert.ok(lyrics.lines[0].words.length > 0, 'phải có timing từng chữ sau alignWords')

  const frames: string[] = []
  const out = {
    write: (s: string) => {
      frames.push(s)
      return true
    },
    columns: 80,
    rows: 24,
    isTTY: true,
  }

  const player = new AfplayPlayer(track.audioPath)
  const renderer = new Renderer(
    {
      title: track.title,
      artist: track.artist,
      lyrics,
      spectrum: null,
      durationMs: track.durationMs,
      playerLabel: player.label,
      canSeek: player.canSeek,
      offsetMs: 0,
      paused: false,
    },
    player,
    out as never,
  )

  renderer.start()
  await player.play()
  await sleep(1200)
  const early = stripAnsi(frames.at(-1) ?? '')
  await sleep(1800)
  const later = stripAnsi(frames.at(-1) ?? '')
  renderer.stop()
  player.stop()

  assert.ok(early.includes('first line'), 'lúc đầu phải đang ở câu đầu')
  assert.ok(later.includes('third line'), `sau 3 giây phải sang câu ba, nhận được:\n${later}`)
  assert.notEqual(early, later, 'khung hình phải đổi theo thời gian')
})

test('đầu-cuối: interpolateWords sinh timing phủ kín mọi câu của lời thật', async () => {
  const track = await resolveLocal(audio)
  saveLrc(track.sourceId, LRC)
  const lyrics = await getLyricsFor(track)
  alignWords(lyrics, null)

  for (const line of lyrics.lines) {
    const words = interpolateWords(line)
    assert.equal(
      words.map((w) => w.text).join(' '),
      line.text,
      `timing phải phủ hết câu "${line.text}"`,
    )
    assert.equal(words[0].startMs, line.startMs)
  }
})

test.after(() => rmSync(process.env.KLRC_HOME!, { recursive: true, force: true }))
