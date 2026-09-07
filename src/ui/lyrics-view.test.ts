import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findActiveLine, splitSung } from './lyrics-view.ts'
import type { Line } from '../lyrics/types.ts'

const lines: Line[] = [
  { startMs: 1000, endMs: 3000, text: 'first', words: [] },
  { startMs: 3000, endMs: 5000, text: 'second', words: [] },
  { startMs: 5000, endMs: 7000, text: 'third', words: [] },
]

test('findActiveLine trả -1 trước câu đầu tiên', () => {
  assert.equal(findActiveLine(lines, 0), -1)
  assert.equal(findActiveLine(lines, 999), -1)
})

test('findActiveLine đúng ở biên startMs', () => {
  assert.equal(findActiveLine(lines, 1000), 0)
  assert.equal(findActiveLine(lines, 3000), 1)
})

test('findActiveLine giữ dòng cuối sau khi hết bài', () => {
  assert.equal(findActiveLine(lines, 99999), 2)
})

test('findActiveLine trên mảng rỗng trả -1', () => {
  assert.equal(findActiveLine([], 1000), -1)
})

test('splitSung chia đúng phần đã hát', () => {
  const words = [
    { startMs: 0, endMs: 1000, text: 'hello' },
    { startMs: 1000, endMs: 2000, text: 'world' },
  ]
  assert.deepEqual(splitSung(words, 0), { sung: '', unsung: 'hello world' })
  // Đúng lúc "hello" xong và "world" chưa bắt đầu: khoảng trắng thuộc phần đã hát.
  assert.deepEqual(splitSung(words, 1000), { sung: 'hello ', unsung: 'world' })
  // Giữa từ "world" thì tô nửa từ, không chờ hết từ mới tô.
  assert.deepEqual(splitSung(words, 1500), { sung: 'hello wor', unsung: 'ld' })
  assert.deepEqual(splitSung(words, 5000), { sung: 'hello world', unsung: '' })
})

test('splitSung tô dần trong lòng một từ theo tỉ lệ ký tự', () => {
  const words = [{ startMs: 0, endMs: 1000, text: 'wonderful' }]
  const half = splitSung(words, 500)
  assert.ok(
    half.sung.length >= 3 && half.sung.length <= 6,
    `giữa từ phải tô khoảng nửa, nhận được "${half.sung}"`,
  )
  assert.equal(half.sung + half.unsung, 'wonderful')
})

test('splitSung luôn bảo toàn câu gốc ở mọi mốc thời gian', () => {
  const words = [
    { startMs: 0, endMs: 700, text: 'Hạ' },
    { startMs: 700, endMs: 1600, text: 'còn' },
    { startMs: 1600, endMs: 2500, text: 'nắng' },
  ]
  for (let ms = -100; ms <= 2600; ms += 37) {
    const { sung, unsung } = splitSung(words, ms)
    assert.equal(sung + unsung, 'Hạ còn nắng', `sai ở ms=${ms}`)
  }
})

test('splitSung với mảng từ rỗng không nổ', () => {
  assert.deepEqual(splitSung([], 100), { sung: '', unsung: '' })
})
