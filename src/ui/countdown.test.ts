import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countdownLine } from './countdown.ts'
import { stripAnsi } from './theme.ts'
import type { Line } from '../lyrics/types.ts'

const lines: Line[] = [
  { startMs: 1000, endMs: 2000, text: 'a', words: [] },
  { startMs: 9000, endMs: 10000, text: 'b', words: [] }, // nghỉ 7 giây
  { startMs: 10500, endMs: 11500, text: 'c', words: [] }, // nghỉ 0.5 giây
]

const dots = (s: string | null) => (stripAnsi(s ?? '').match(/●/g) ?? []).length

test('quãng nghỉ dài thì hiện dấu đếm ngược', () => {
  const out = countdownLine(lines, 5000, 40)
  assert.ok(out !== null && out.includes('●'))
})

test('quãng nghỉ ngắn dưới 3 giây thì không hiện', () => {
  assert.equal(countdownLine(lines, 10200, 40), null)
})

test('đang giữa câu thì không hiện', () => {
  assert.equal(countdownLine(lines, 1500, 40), null)
})

test('càng gần câu mới thì càng ít dấu', () => {
  assert.ok(dots(countdownLine(lines, 8500, 40)) < dots(countdownLine(lines, 3000, 40)))
})

test('trước câu đầu tiên, nếu nhạc dạo dài, cũng hiện', () => {
  const late: Line[] = [{ startMs: 8000, endMs: 9000, text: 'x', words: [] }]
  assert.ok(countdownLine(late, 1000, 40) !== null)
})

test('sau câu cuối trả null', () => {
  assert.equal(countdownLine(lines, 20000, 40), null)
})

test('độ dài không vượt width', () => {
  const out = countdownLine(lines, 5000, 20)
  assert.ok(stripAnsi(out ?? '').length <= 20)
})

test('mảng rỗng trả null', () => {
  assert.equal(countdownLine([], 1000, 40), null)
})

test('luôn có ít nhất một dấu khi đang trong quãng nghỉ', () => {
  assert.ok(dots(countdownLine(lines, 8999, 40)) >= 1)
})
