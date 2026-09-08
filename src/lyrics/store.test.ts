import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'klrc-test-'))
process.env.KLRC_HOME = dir

const store = await import('./store.ts')

test('lưu rồi đọc lại được .lrc', () => {
  store.saveLrc('abc', '[00:01.00] hi')
  assert.equal(store.loadLrc('abc'), '[00:01.00] hi')
})

test('bài chưa có trả null', () => {
  assert.equal(store.loadLrc('chua-co'), null)
})

test('offset mặc định 0, lưu rồi đọc lại đúng', () => {
  assert.equal(store.loadOffset('abc'), 0)
  store.saveOffset('abc', -250)
  assert.equal(store.loadOffset('abc'), -250)
})

test('offset của bài này không ảnh hưởng bài khác', () => {
  store.saveOffset('bai-1', 500)
  assert.equal(store.loadOffset('bai-2'), 0)
})

test('lưu và đọc lại sourceId gần nhất', () => {
  store.saveLast('bai-vua-nghe')
  assert.equal(store.loadLast(), 'bai-vua-nghe')
})

test('config.json hỏng không làm chết app, coi như rỗng', () => {
  writeFileSync(join(dir, 'config.json'), 'không phải json')
  assert.equal(store.loadOffset('abc'), 0)
  assert.equal(store.loadLast(), null)
})

test('ghi được sau khi config hỏng (tự viết lại file)', () => {
  store.saveOffset('abc', 125)
  assert.equal(store.loadOffset('abc'), 125)
})

test('lrcPath nằm trong thư mục lyrics', () => {
  assert.ok(store.lrcPath('abc').endsWith('/lyrics/abc.lrc'))
})

test('audioPath và spectrumPath nằm đúng thư mục con', () => {
  assert.ok(store.audioPath('abc').endsWith('/audio/abc.m4a'))
  assert.ok(store.spectrumPath('abc').endsWith('/spectrum/abc.json'))
})

test.after(() => rmSync(dir, { recursive: true, force: true }))
