import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spectrumLine } from './spectrum.ts'
import { stripAnsi } from './theme.ts'

const sp = {
  frameMs: 50,
  bands: 16,
  frames: Array.from({ length: 100 }, () => Uint8Array.from({ length: 16 }, (_, i) => i * 16)),
}

test('dài đúng width yêu cầu', () => {
  for (const w of [16, 40, 80]) {
    assert.equal(stripAnsi(spectrumLine(sp, 1000, w)).length, w)
  }
})

test('vượt quá cuối bài trả dòng trống cùng độ dài', () => {
  const out = stripAnsi(spectrumLine(sp, 999999, 40))
  assert.equal(out.length, 40)
  assert.equal(out.trim(), '')
})

test('vị trí âm cũng trả dòng trống, không nổ', () => {
  assert.equal(stripAnsi(spectrumLine(sp, -500, 40)).length, 40)
})

test('không có frame nào thì không nổ', () => {
  const empty = { frameMs: 50, bands: 16, frames: [] }
  assert.equal(stripAnsi(spectrumLine(empty, 0, 20)).length, 20)
})

test('width nhỏ hơn số dải vẫn ra đúng độ dài', () => {
  assert.equal(stripAnsi(spectrumLine(sp, 1000, 8)).length, 8)
})

test('width bằng 0 trả chuỗi rỗng', () => {
  assert.equal(spectrumLine(sp, 1000, 0), '')
})

test('dải mạnh cho ký tự cao hơn dải yếu', () => {
  const frame = Uint8Array.from({ length: 2 }, (_, i) => (i === 0 ? 10 : 250))
  const one = { frameMs: 50, bands: 2, frames: [frame] }
  const out = stripAnsi(spectrumLine(one, 0, 2))
  const blocks = ' ▁▂▃▄▅▆▇█'
  assert.ok(blocks.indexOf(out[1]) > blocks.indexOf(out[0]), `nhận được "${out}"`)
})
