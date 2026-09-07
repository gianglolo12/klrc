import { execFile } from 'node:child_process'

/**
 * Mở lệnh trong một cửa sổ terminal mới.
 *
 * Vì sao phải làm vậy: slash command của Claude Code chỉ nhờ Claude chạy Bash,
 * và ở đó stdout bị capture chứ không phải TTY — animation ANSI sẽ vỡ thành
 * hàng nghìn dòng escape code, còn Bash tool thì có timeout nên bài 4 phút bị
 * cắt giữa. Cửa sổ mới có TTY riêng, và Claude Code rảnh ngay.
 */

const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

export function buildOpenCommand(cmd: string, termProgram: string | undefined): string[] {
  if (termProgram === 'iTerm.app') {
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

/** Bọc chuỗi cho shell của cửa sổ mới, an toàn với dấu nháy trong tên bài. */
export const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

export function openInNewTerminal(cmd: string): Promise<void> {
  const argv = buildOpenCommand(cmd, process.env.TERM_PROGRAM)
  return new Promise((resolve, reject) => {
    execFile(argv[0], argv.slice(1), (err) => {
      if (err) reject(new Error(`Could not open a new Terminal window: ${err.message}`))
      else resolve()
    })
  })
}
