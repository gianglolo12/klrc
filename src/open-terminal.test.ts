import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOpenCommand, shellQuote } from './open-terminal.ts'

test('iTerm dùng osascript nhắm iTerm', () => {
  const a = buildOpenCommand('klrc x', 'iTerm.app')
  assert.equal(a[0], 'osascript')
  assert.ok(a.join(' ').includes('iTerm'))
})

test('Terminal.app dùng osascript nhắm Terminal', () => {
  const a = buildOpenCommand('klrc x', 'Apple_Terminal')
  assert.equal(a[0], 'osascript')
  assert.ok(a.join(' ').includes('Terminal'))
})

test('TERM_PROGRAM lạ thì fallback về Terminal, không bỏ mặc', () => {
  assert.ok(buildOpenCommand('klrc x', 'Orca').join(' ').includes('Terminal'))
})

test('TERM_PROGRAM không có cũng fallback', () => {
  assert.ok(buildOpenCommand('klrc x', undefined).length > 0)
})

test('escape dấu ngoặc kép để không hỏng AppleScript', () => {
  const s = buildOpenCommand('klrc "a b"', 'Apple_Terminal').join(' ')
  assert.ok(s.includes('\\"'), 'dấu ngoặc kép phải được escape')
})

test('escape dấu gạch chéo ngược', () => {
  const s = buildOpenCommand('klrc a\\b', 'Apple_Terminal').join(' ')
  assert.ok(s.includes('\\\\'))
})

test('shellQuote bọc được dấu nháy đơn trong tên bài', () => {
  assert.equal(shellQuote("it's a song"), `'it'\\''s a song'`)
})

test('shellQuote giữ nguyên chuỗi thường', () => {
  assert.equal(shellQuote('https://youtu.be/abc'), `'https://youtu.be/abc'`)
})
