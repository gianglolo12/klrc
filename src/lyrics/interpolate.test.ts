import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpolateWords } from './interpolate.ts'
import type { Line } from './types.ts'

const line = (text: string, startMs = 0, endMs = 4000): Line => ({
  text,
  startMs,
  endMs,
  words: [],
})

test('chia thời gian theo độ dài từ, không chia đều theo số từ', () => {
  const w = interpolateWords(line('a wonderful day', 0, 3000))
  assert.equal(w.length, 3)
  assert.equal(w[0].startMs, 0)
  assert.equal(w.at(-1)!.endMs, 3000)
  const dur = (x: (typeof w)[0]) => x.endMs - x.startMs
  assert.ok(dur(w[1]) > dur(w[0]) * 3, 'từ dài phải chiếm nhiều thời gian hơn rõ rệt')
})

test('các từ liền mạch: endMs của từ trước = startMs của từ sau', () => {
  const w = interpolateWords(line('one two three four', 1000, 5000))
  for (let i = 1; i < w.length; i++) {
    assert.equal(w[i].startMs, w[i - 1].endMs)
  }
})

test('giữ nguyên words nếu đã có sẵn từ enhanced LRC', () => {
  const pre: Line = {
    text: 'hello world',
    startMs: 0,
    endMs: 2000,
    words: [
      { startMs: 0, endMs: 900, text: 'hello' },
      { startMs: 900, endMs: 2000, text: 'world' },
    ],
  }
  assert.deepEqual(interpolateWords(pre), pre.words)
})

test('câu một từ chiếm toàn bộ khoảng thời gian', () => {
  const w = interpolateWords(line('oh', 500, 1500))
  assert.deepEqual(w, [{ startMs: 500, endMs: 1500, text: 'oh' }])
})

test('câu rỗng trả mảng rỗng', () => {
  assert.deepEqual(interpolateWords(line('', 0, 1000)), [])
  assert.deepEqual(interpolateWords(line('   ', 0, 1000)), [])
})

test('khoảng thời gian bằng 0 hoặc âm không sinh NaN', () => {
  const w = interpolateWords(line('a b c', 1000, 1000))
  assert.ok(w.every((x) => Number.isFinite(x.startMs) && Number.isFinite(x.endMs)))
})

test('tiếng Việt có dấu tính đúng số từ và giữ nguyên chữ', () => {
  const w = interpolateWords(line('Trời xanh mây trắng', 0, 4000))
  assert.equal(w.length, 4)
  assert.equal(w.map((x) => x.text).join(' '), 'Trời xanh mây trắng')
})

test('câu dài bị chặn tốc độ tối thiểu 60ms mỗi từ', () => {
  const many = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ')
  const w = interpolateWords(line(many, 0, 1000))
  assert.ok(w.every((x) => x.endMs - x.startMs >= 60))
})
