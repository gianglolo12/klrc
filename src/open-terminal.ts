import { execFile } from 'node:child_process'

/**
 * Mở lệnh trong một TTY thật, tách khỏi tiến trình đang gọi.
 *
 * Vì sao phải làm vậy: slash command của Claude Code chỉ nhờ Claude chạy Bash,
 * và ở đó stdout bị capture chứ không phải TTY — animation ANSI sẽ vỡ thành
 * hàng nghìn dòng escape code, còn Bash tool thì có timeout nên bài 4 phút bị
 * cắt giữa. Một pane hay cửa sổ riêng có TTY của nó, và Claude Code rảnh ngay.
 */

const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

/**
 * Chia ngang chứ không chia dọc: lời cần chiều rộng hơn chiều cao. Chia dọc để
 * lại chừng 40 cột mỗi bên, hẹp tới mức khung hình phải bỏ cả phổ nhạc lẫn
 * thanh tiến độ.
 *
 * Số dòng cố định chứ không theo phần trăm: khung hình cần từ 12 dòng mới đủ
 * chỗ cho phổ nhạc, mà 45% của một terminal 24 dòng chỉ ra 10 dòng — vừa đúng
 * mức bị cắt mất hiệu ứng. 14 dòng là đủ đầy đủ mà vẫn để lại phần lớn cửa sổ
 * cho cuộc trò chuyện.
 */
const TMUX_PANE_LINES = '14'

export type Environment = {
  /** Biến `$TMUX`, chỉ có giá trị khi tiến trình chạy bên trong tmux. */
  tmux?: string
  /** Biến `$TERM_PROGRAM`. */
  termProgram?: string
}

export function buildOpenCommand(cmd: string, env: Environment): string[] {
  // Đang ở trong tmux thì mở pane ngay cạnh, không nhảy sang cửa sổ khác.
  // Pane tự đóng khi bài hết, vì tmux đóng pane lúc lệnh thoát.
  if (env.tmux) {
    return ['tmux', 'split-window', '-v', '-l', TMUX_PANE_LINES, cmd]
  }

  if (env.termProgram === 'iTerm.app') {
    return [
      'osascript',
      '-e',
      'tell application "iTerm" to create window with default profile',
      '-e',
      `tell application "iTerm" to tell current session of current window to write text "${esc(cmd)}"`,
    ]
  }

  // Mọi trường hợp còn lại, kể cả $TERM_PROGRAM lạ hoặc rỗng: Terminal.app luôn
  // có trên macOS, nên đây là đường lùi an toàn thay vì bỏ mặc người dùng.
  return [
    'osascript',
    '-e',
    `tell application "Terminal" to do script "${esc(cmd)}"`,
    '-e',
    'tell application "Terminal" to activate',
  ]
}

/** Bọc chuỗi cho shell của pane/cửa sổ mới, an toàn với dấu nháy trong tên bài. */
export const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

/** Nơi karaoke sẽ mở, để thông báo cho người dùng biết nhìn đâu. */
export const describeTarget = (env: Environment): string =>
  env.tmux ? 'a new tmux pane' : 'a new Terminal window'

export function openInNewTerminal(cmd: string): Promise<void> {
  const env: Environment = {
    tmux: process.env.TMUX,
    termProgram: process.env.TERM_PROGRAM,
  }
  const argv = buildOpenCommand(cmd, env)
  return new Promise((resolve, reject) => {
    execFile(argv[0], argv.slice(1), (err) => {
      if (err) reject(new Error(`Could not open ${describeTarget(env)}: ${err.message}`))
      else resolve()
    })
  })
}

export const currentEnvironment = (): Environment => ({
  tmux: process.env.TMUX,
  termProgram: process.env.TERM_PROGRAM,
})
