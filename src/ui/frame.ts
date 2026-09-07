import type { Lyrics } from '../lyrics/types.ts'
import type { Spectrum } from '../audio/spectrum-types.ts'
import { findActiveLine, splitSung } from './lyrics-view.ts'
import { formatOffset, formatTime, progressBar } from './progress.ts'
import { spectrumLine } from './spectrum.ts'
import { countdownLine } from './countdown.ts'
import { ACCENT, FAR, NEAR, RESET, SUNG, UNSUNG, gradientAt, stripAnsi } from './theme.ts'

export type ViewState = {
  title: string
  artist: string
  lyrics: Lyrics
  spectrum: Spectrum | null
  durationMs: number
  playerLabel: string
  canSeek: boolean
  offsetMs: number
  paused: boolean
}

/** Dưới ngưỡng này thì spectrum chen chúc thành một vệt, bỏ đi đẹp hơn. */
const MIN_WIDTH_SPECTRUM = 60
const MIN_WIDTH_PROGRESS = 50
const SIDE_PADDING = 3

const clampVisible = (s: string, max: number): string => {
  // Chỉ cắt được an toàn trên chuỗi chưa nhuộm màu; hàm này luôn nhận chuỗi thô.
  return s.length <= max ? s : s.slice(0, Math.max(max, 0))
}

const centered = (text: string, width: number): string => {
  const w = stripAnsi(text).length
  const pad = Math.max(Math.floor((width - w) / 2), 0)
  return ' '.repeat(pad) + text
}

function headerLine(s: ViewState, positionMs: number, width: number): string {
  const rightParts = [`${s.playerLabel} ●`]
  if (s.offsetMs !== 0) rightParts.push(formatOffset(s.offsetMs))
  if (s.paused) rightParts.push('paused')
  const right = rightParts.join('   ')

  const left = s.artist ? `${s.title} · ${s.artist}` : s.title
  const room = width - SIDE_PADDING - stripAnsi(right).length - 2
  const leftCut = clampVisible(left, Math.max(room, 0))

  const gap = Math.max(width - SIDE_PADDING - leftCut.length - right.length, 1)
  return ` ${SUNG()}${leftCut}${RESET()}${' '.repeat(gap)}${FAR()}${right}${RESET()}`
}

const ruleLine = (width: number): string => ` ${FAR()}${'─'.repeat(Math.max(width - 2, 0))}${RESET()}`

function keysLine(s: ViewState, width: number): string {
  const keys = ['space pause']
  if (s.canSeek) keys.push('←→ seek 5s')
  keys.push('[ ] sync', 'q quit')
  const text = keys.join('    ')
  return ` ${FAR()}${clampVisible(text, Math.max(width - 3, 0))}${RESET()}`
}

/**
 * Khối lời. Câu đang hát nằm ở một phần ba trên chứ không phải chính giữa: mắt
 * đọc xuôi xuống, nên chỗ cho câu *sắp* hát quan trọng hơn câu đã qua.
 */
function lyricsBlock(s: ViewState, positionMs: number, width: number, height: number): string[] {
  const out: string[] = []
  const maxText = Math.max(width - SIDE_PADDING * 2, 8)
  const lines = s.lyrics.lines

  if (lines.length === 0) {
    out.push(centered(`${FAR()}(no lyrics)${RESET()}`, width))
    while (out.length < height) out.push('')
    return out.slice(0, height)
  }

  if (!s.lyrics.hasTiming) {
    out.push(centered(`${ACCENT()}(no timing for this song — lyrics only)${RESET()}`, width))
    for (const line of lines.slice(0, Math.max(height - 1, 0))) {
      out.push(centered(`${NEAR()}${clampVisible(line.text, maxText)}${RESET()}`, width))
    }
    while (out.length < height) out.push('')
    return out.slice(0, height)
  }

  const active = findActiveLine(lines, positionMs)
  const above = Math.floor(height / 3)
  const start = active - above

  const progress = s.durationMs > 0 ? positionMs / s.durationMs : 0
  const activeColor = gradientAt(progress) || SUNG()

  for (let i = start; out.length < height; i++) {
    if (i < 0 || i >= lines.length) {
      out.push('')
      continue
    }

    const line = lines[i]
    const distance = Math.abs(i - active)

    if (i === active) {
      const { sung, unsung } = splitSung(line.words, positionMs)
      const full = clampVisible(sung + unsung, maxText)
      const sungLen = Math.min(sung.length, full.length)
      const head = full.slice(0, sungLen)
      const tail = full.slice(sungLen)

      const pad = Math.max(Math.floor((width - full.length) / 2), 0)
      out.push(
        `${' '.repeat(pad)}${activeColor}${head}${RESET()}${UNSUNG()}${tail}${RESET()}`,
      )
      // Gạch chân chạy theo phần đã hát: bắt nhịp bằng hình nhanh hơn bằng màu,
      // và không phụ thuộc bảng màu của từng terminal.
      if (out.length < height) {
        out.push(`${' '.repeat(pad)}${activeColor}${'▔'.repeat(head.length)}${RESET()}`)
      }
      continue
    }

    const color = distance === 1 ? NEAR() : FAR()
    out.push(centered(`${color}${clampVisible(line.text, maxText)}${RESET()}`, width))
  }

  // Quãng nghỉ dài: chèn dấu đếm ngược vào dòng trống ngay dưới câu đang hát,
  // để người xem biết còn bao lâu thay vì tưởng app treo.
  const countdown = countdownLine(lines, positionMs, width)
  if (countdown) {
    const anchor = out.findIndex((l, i) => i > above && stripAnsi(l).trim() === '')
    if (anchor >= 0) out[anchor] = countdown
  }

  return out.slice(0, height)
}

export function renderFrame(
  s: ViewState,
  positionMs: number,
  width: number,
  height: number,
): string {
  const w = Math.max(width, 20)
  const h = Math.max(height, 4)

  const showRules = h >= 8
  const showKeys = h >= 10
  const showProgress = w >= MIN_WIDTH_PROGRESS && h >= 7
  const showSpectrum = s.spectrum !== null && w >= MIN_WIDTH_SPECTRUM && h >= 12

  const top = 1 + (showRules ? 1 : 0)
  const bottom =
    (showRules ? 1 : 0) + (showSpectrum ? 1 : 0) + (showProgress ? 1 : 0) + (showKeys ? 1 : 0)
  const lyricsHeight = Math.max(h - top - bottom, 1)

  const parts: string[] = [headerLine(s, positionMs, w)]
  if (showRules) parts.push(ruleLine(w))
  parts.push(...lyricsBlock(s, positionMs, w, lyricsHeight))
  if (showRules) parts.push(ruleLine(w))

  if (showSpectrum && s.spectrum) {
    parts.push(` ${spectrumLine(s.spectrum, positionMs, Math.max(w - 3, 0))}`)
  }

  if (showProgress) {
    const time = `${formatTime(positionMs)} / ${formatTime(s.durationMs)}`
    const barWidth = Math.max(w - time.length - SIDE_PADDING * 2 - 2, 4)
    const ratio = s.durationMs > 0 ? positionMs / s.durationMs : 0
    parts.push(` ${ACCENT()}${progressBar(ratio, barWidth)}${RESET()} ${FAR()}${time}${RESET()}`)
  }

  if (showKeys) parts.push(keysLine(s, w))

  return parts.slice(0, h).join('\n')
}
