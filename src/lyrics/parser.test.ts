import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLrc } from './parser.ts'

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8')

test('đọc timestamp theo dòng, bỏ metadata tag', () => {
  const r = parseLrc(fx('simple.lrc'))
  assert.equal(r.hasTiming, true)
  assert.equal(r.lines.length, 4) // dòng rỗng [00:20.00] bị loại
  assert.equal(r.lines[0].startMs, 9650)
  assert.equal(r.lines[0].text, 'first line here')
})

test('endMs của mỗi dòng là startMs của dòng sau', () => {
  const r = parseLrc(fx('simple.lrc'))
  assert.equal(r.lines[0].endMs, 12100)
  assert.equal(r.lines[1].endMs, 14810)
})

test('dòng cuối được cho endMs = startMs + 5000', () => {
  const r = parseLrc(fx('simple.lrc'))
  const last = r.lines.at(-1)!
  assert.equal(last.startMs, 22500)
  assert.equal(last.endMs, 27500)
})

test('đọc enhanced LRC ra timing từng chữ', () => {
  const r = parseLrc(fx('enhanced.lrc'))
  assert.equal(r.lines[0].words.length, 3)
  assert.deepEqual(r.lines[0].words[0], { startMs: 5000, endMs: 5800, text: 'hello' })
  assert.equal(r.lines[0].words[2].text, 'world')
  assert.equal(r.lines[0].text, 'hello big world')
})

test('LRC không có timestamp nào -> hasTiming false, giữ nguyên text', () => {
  const r = parseLrc('just some words\nand more words')
  assert.equal(r.hasTiming, false)
  assert.equal(r.lines.length, 2)
  assert.equal(r.lines[0].text, 'just some words')
})

test('chấp nhận cả [mm:ss.xx] và [mm:ss.xxx] và [mm:ss]', () => {
  const r = parseLrc('[00:01]a\n[00:02.5]b\n[00:03.250]c')
  assert.deepEqual(
    r.lines.map((l) => l.startMs),
    [1000, 2500, 3250],
  )
})

test('nhiều timestamp trên một dòng -> nhân thành nhiều dòng, sắp xếp tăng dần', () => {
  const r = parseLrc('[00:10.00][00:30.00] chorus line')
  assert.deepEqual(
    r.lines.map((l) => l.startMs),
    [10000, 30000],
  )
  assert.equal(r.lines[1].text, 'chorus line')
})

test('phút lớn hơn 59 vẫn tính đúng', () => {
  const r = parseLrc('[61:05.00] long song')
  assert.equal(r.lines[0].startMs, 61 * 60000 + 5000)
})

test('file rỗng không làm nổ', () => {
  const r = parseLrc('')
  assert.equal(r.lines.length, 0)
  assert.equal(r.hasTiming, false)
})
