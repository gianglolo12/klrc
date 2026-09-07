import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fft } from './fft.ts'

test('sin thuần ở bin 4 cho đỉnh đúng ở bin 4', () => {
  const N = 64
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  for (let i = 0; i < N; i++) re[i] = Math.sin((2 * Math.PI * 4 * i) / N)
  fft(re, im)
  const mag = Array.from({ length: N / 2 }, (_, k) => Math.hypot(re[k], im[k]))
  assert.equal(mag.indexOf(Math.max(...mag)), 4)
})

test('tín hiệu hằng cho toàn bộ năng lượng ở bin 0', () => {
  const N = 32
  const re = new Float64Array(N).fill(1)
  const im = new Float64Array(N)
  fft(re, im)
  assert.ok(Math.abs(re[0] - N) < 1e-9)
  for (let k = 1; k < N; k++) {
    assert.ok(Math.hypot(re[k], im[k]) < 1e-9, `bin ${k} phải bằng 0`)
  }
})

test('cosin ở bin cao cũng đúng vị trí', () => {
  const N = 128
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  for (let i = 0; i < N; i++) re[i] = Math.cos((2 * Math.PI * 40 * i) / N)
  fft(re, im)
  const mag = Array.from({ length: N / 2 }, (_, k) => Math.hypot(re[k], im[k]))
  assert.equal(mag.indexOf(Math.max(...mag)), 40)
})

test('độ dài không phải luỹ thừa của 2 thì ném lỗi', () => {
  assert.throws(() => fft(new Float64Array(30), new Float64Array(30)), /power of two/i)
})

test('hai mảng lệch độ dài thì ném lỗi', () => {
  assert.throws(() => fft(new Float64Array(32), new Float64Array(16)), /same length/i)
})

test('N = 1 không nổ', () => {
  assert.doesNotThrow(() => fft(new Float64Array(1), new Float64Array(1)))
})
