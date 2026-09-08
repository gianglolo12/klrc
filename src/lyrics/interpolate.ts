import { countSyllables } from './syllables.ts'
import type { Line, Word } from './types.ts'

/**
 * Sàn thời gian mỗi từ. Không có nó, một câu 40 từ trong 1 giây sẽ cho những từ
 * dài 25ms — nhanh hơn cả một khung hình, mắt chỉ thấy cả câu sáng cùng lúc.
 */
const MIN_WORD_MS = 60

/** Khoảng thời gian để rải chữ vào. Mặc định là cả dòng. */
export type Window = { startMs: number; endMs: number }

/**
 * Suy ra timing từng chữ từ timing của cả dòng.
 *
 * LRCLIB không bao giờ cho timing từng chữ (đã kiểm trên nhiều bài phổ biến),
 * nên đây là đường chính chứ không phải dự phòng.
 *
 * Trọng số theo số âm tiết, không theo số ký tự: tiếng Việt đơn âm nên mọi
 * tiếng hát gần bằng nhau, mà chia theo ký tự cho tiếng dài tới gấp đôi thời
 * gian tiếng ngắn — sai đều suốt bài. Xem `syllables.ts`.
 *
 * `window` cho phép rải chữ vào một khoảng hẹp hơn cả dòng — dùng khi đã dò
 * được đoạn thật sự có tiếng hát (xem `vocal-window.ts`).
 */
export function interpolateWords(line: Line, window?: Window): Word[] {
  if (line.words.length > 0) return line.words

  const tokens = line.text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const from = window?.startMs ?? line.startMs
  const to = window?.endMs ?? line.endMs

  const weights = tokens.map((t) => countSyllables(t))
  const total = weights.reduce((a, b) => a + b, 0)
  const span = Math.max(to - from, 0)

  const words: Word[] = []
  let cursor = from
  for (let i = 0; i < tokens.length; i++) {
    const dur = Math.max(Math.round((span * weights[i]) / total), MIN_WORD_MS)
    words.push({ startMs: cursor, endMs: cursor + dur, text: tokens[i] })
    cursor += dur
  }

  // Khớp lại đúng mốc kết thúc, nhưng chỉ khi việc đó không làm từ cuối co lại
  // thành âm (xảy ra khi sàn MIN_WORD_MS đã đẩy cursor vượt mốc).
  const last = words.at(-1)!
  if (to >= last.startMs) last.endMs = to

  return words
}
