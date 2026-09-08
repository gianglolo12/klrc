import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOpenCommand, describeTarget, shellQuote } from './open-terminal.ts'

test('trong tmux thì mở pane, không nhảy sang cửa sổ khác', () => {
  const a = buildOpenCommand('klrc x', { tmux: '/tmp/tmux-501/default,123,0' })
  assert.equal(a[0], 'tmux')
  assert.ok(a.includes('split-window'))
  assert.ok(a.includes('klrc x'), 'lệnh phải được truyền nguyên cho tmux')
})

test('pane tmux chia ngang để giữ nguyên chiều rộng cho lời', () => {
  const a = buildOpenCommand('klrc x', { tmux: 'sock,1,0' })
  assert.ok(a.includes('-v'), 'phải chia ngang (-v), không chia dọc')
  assert.ok(!a.includes('-h'))
})

test('pane cao ít nhất 12 dòng để khung hình còn đủ phổ nhạc', () => {
  const a = buildOpenCommand('klrc x', { tmux: 'sock,1,0' })
  const size = a[a.indexOf('-l') + 1]
  assert.ok(!size.includes('%'), 'phải là số dòng cố định, không phải phần trăm — 45% của terminal 24 dòng chỉ ra 10 dòng')
  assert.ok(Number(size) >= 12, `pane ${size} dòng là quá thấp cho khung hình đầy đủ`)
})

test('tmux thắng cả TERM_PROGRAM: đang trong tmux thì ưu tiên pane', () => {
  const a = buildOpenCommand('klrc x', { tmux: 'sock,1,0', termProgram: 'iTerm.app' })
  assert.equal(a[0], 'tmux')
})

test('iTerm dùng osascript nhắm iTerm', () => {
  const a = buildOpenCommand('klrc x', { termProgram: 'iTerm.app' })
  assert.equal(a[0], 'osascript')
  assert.ok(a.join(' ').includes('iTerm'))
})

test('Terminal.app dùng osascript nhắm Terminal', () => {
  const a = buildOpenCommand('klrc x', { termProgram: 'Apple_Terminal' })
  assert.equal(a[0], 'osascript')
  assert.ok(a.join(' ').includes('Terminal'))
})

test('TERM_PROGRAM lạ thì fallback về Terminal, không bỏ mặc', () => {
  assert.ok(buildOpenCommand('klrc x', { termProgram: 'Orca' }).join(' ').includes('Terminal'))
})

test('môi trường rỗng hoàn toàn cũng fallback', () => {
  assert.ok(buildOpenCommand('klrc x', {}).length > 0)
})

test('escape dấu ngoặc kép để không hỏng AppleScript', () => {
  const s = buildOpenCommand('klrc "a b"', { termProgram: 'Apple_Terminal' }).join(' ')
  assert.ok(s.includes('\\"'), 'dấu ngoặc kép phải được escape')
})

test('escape dấu gạch chéo ngược', () => {
  const s = buildOpenCommand('klrc a\\b', { termProgram: 'Apple_Terminal' }).join(' ')
  assert.ok(s.includes('\\\\'))
})

test('tmux không cần escape AppleScript vì lệnh đi qua argv', () => {
  const a = buildOpenCommand('klrc "a b"', { tmux: 'sock,1,0' })
  assert.ok(a.includes('klrc "a b"'), 'phải giữ nguyên chuỗi, không thêm dấu escape')
})

test('shellQuote bọc được dấu nháy đơn trong tên bài', () => {
  assert.equal(shellQuote("it's a song"), `'it'\\''s a song'`)
})

test('shellQuote giữ nguyên chuỗi thường', () => {
  assert.equal(shellQuote('https://youtu.be/abc'), `'https://youtu.be/abc'`)
})

test('describeTarget nói đúng nơi karaoke sẽ mở', () => {
  assert.match(describeTarget({ tmux: 'sock,1,0' }), /tmux/)
  assert.match(describeTarget({ termProgram: 'Apple_Terminal' }), /Terminal window/)
})
