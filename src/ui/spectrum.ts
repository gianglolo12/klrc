import type { Spectrum } from '../audio/spectrum-types.ts'
import { gradientAt, RESET } from './theme.ts'

const BLOCKS = ' ▁▂▃▄▅▆▇█'

/**
 * Một dòng phổ nhạc tại thời điểm `positionMs`.
 *
 * Không phân tích âm thanh ở đây — spectrum đã được tính trước cho cả bài, nên
 * việc duy nhất là tra mảng theo đồng hồ. Nhờ vậy CPU gần bằng 0 và phổ khớp
 * nhạc chính xác thay vì phỏng đoán.
 */
export function spectrumLine(spectrum: Spectrum, positionMs: number, width: number): string {
  if (width <= 0) return ''

  const idx = Math.floor(positionMs / spectrum.frameMs)
  const frame = idx >= 0 && idx < spectrum.frames.length ? spectrum.frames[idx] : null
  if (!frame || frame.length === 0) return ' '.repeat(width)

  let out = ''
  for (let col = 0; col < width; col++) {
    const band = Math.min(Math.floor((col * frame.length) / width), frame.length - 1)
    const level = Math.min(Math.floor((frame[band] / 256) * BLOCKS.length), BLOCKS.length - 1)
    out += BLOCKS[level]
  }

  const color = gradientAt(idx / Math.max(spectrum.frames.length, 1))
  return color ? `${color}${out}${RESET()}` : out
}
