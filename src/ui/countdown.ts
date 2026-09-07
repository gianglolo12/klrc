import type { Line } from '../lyrics/types.ts'
import { FAR, RESET, stripAnsi } from './theme.ts'

/** Quãng nghỉ ngắn hơn mức này thì không cần báo — câu tiếp tới ngay. */
const MIN_GAP_MS = 3000
const MAX_DOTS = 5

/**
 * Dấu đếm ngược cho quãng nhạc dạo hoặc khoảng lặng giữa hai đoạn.
 *
 * Không có nó, người xem ngồi trước màn hình đứng im và tưởng app treo.
 * Trả `null` khi đang giữa câu hoặc quãng nghỉ quá ngắn.
 */
export function countdownLine(lines: Line[], positionMs: number, width: number): string | null {
  if (lines.length === 0) return null

  const nextIndex = lines.findIndex((l) => l.startMs > positionMs)
  if (nextIndex === -1) return null

  const next = lines[nextIndex]
  const prevEnd = nextIndex > 0 ? lines[nextIndex - 1].endMs : 0

  if (next.startMs - prevEnd < MIN_GAP_MS) return null
  if (positionMs < prevEnd) return null

  const remain = next.startMs - positionMs
  const dots = Math.min(Math.max(Math.ceil(remain / 1000), 1), MAX_DOTS)
  const text = Array.from({ length: dots }, () => '●').join(' ')

  const body = `${FAR()}${text}${RESET()}`
  const pad = Math.max(Math.floor((width - stripAnsi(body).length) / 2), 0)
  return ' '.repeat(pad) + body
}
