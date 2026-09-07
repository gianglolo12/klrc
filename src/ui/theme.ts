/**
 * Màu và mã điều khiển terminal.
 *
 * Mọi escape viết bằng `\x1b`, không bao giờ chèn ký tự ESC thật vào source —
 * ký tự thật làm hỏng diff, grep và heredoc.
 */

/** Tắt màu khi NO_COLOR được đặt, hoặc khi output không phải terminal. */
const colorOn = (): boolean => !process.env.NO_COLOR && process.stdout.isTTY !== false

const sgr = (code: string): string => (colorOn() ? `\x1b[${code}m` : '')

/** Bốn cấp độ sáng, theo khoảng cách tới câu đang hát. */
export const SUNG = (): string => sgr('1;97')
export const UNSUNG = (): string => sgr('37')
export const NEAR = (): string => sgr('90')
export const FAR = (): string => sgr('2;90')
export const ACCENT = (): string => sgr('36')
export const RESET = (): string => sgr('0')

export const HIDE_CURSOR = '\x1b[?25l'
export const SHOW_CURSOR = '\x1b[?25h'
export const HOME = '\x1b[H'
export const CLEAR_LINE = '\x1b[K'
export const CLEAR_BELOW = '\x1b[J'

export const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')

/** Bề rộng hiển thị thật: bỏ mã màu trước khi đếm. */
export const visibleWidth = (s: string): number => stripAnsi(s).length

/**
 * Gradient dịch tông dần theo tiến độ bài hát: xanh lơ → tím → hồng → hổ phách.
 * Đi qua các mốc 256-color thay vì đổi hue liên tục, để không chớp nháy.
 */
const GRADIENT_STOPS = [45, 111, 141, 176, 211, 215, 222]

export function gradientAt(ratio: number): string {
  if (!colorOn()) return ''
  const r = Math.min(Math.max(ratio, 0), 1)
  const idx = Math.min(Math.floor(r * GRADIENT_STOPS.length), GRADIENT_STOPS.length - 1)
  return `\x1b[1;38;5;${GRADIENT_STOPS[idx]}m`
}
