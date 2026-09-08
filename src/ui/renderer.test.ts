import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Renderer } from './renderer.ts'
import { FakePlayer } from '../audio/fake-player.ts'
import { parseLrc } from '../lyrics/parser.ts'
import { interpolateWords } from '../lyrics/interpolate.ts'
import { stripAnsi } from './theme.ts'
import type { ViewState } from './frame.ts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const fakeOut = () => {
  const chunks: string[] = []
  const stream = {
    write: (s: string) => {
      chunks.push(s)
      return true
    },
    columns: 80,
    rows: 24,
    isTTY: true,
  }
  return { stream, chunks }
}

const st = (): ViewState => {
  const lyrics = parseLrc('[00:01.00] one\n[00:03.00] two')
  lyrics.lines.forEach((l) => {
    l.words = interpolateWords(l)
  })
  return {
    title: 'T',
    artist: 'A',
    lyrics,
    spectrum: null,
    durationMs: 10000,
    playerLabel: 'fake',
    canSeek: true,
    offsetMs: 0,
    paused: false,
  }
}

test('vẽ liên tục khi chạy', async () => {
  const { stream, chunks } = fakeOut()
  const p = new FakePlayer()
  const r = new Renderer(st(), p, stream as never)
  r.start()
  for (let i = 0; i < 6; i++) {
    p.setPosition(1000 + i * 400)
    await sleep(50)
  }
  r.stop()
  assert.ok(chunks.length >= 3, `phải vẽ nhiều khung, chỉ có ${chunks.length}`)
})

test('stop thì thôi vẽ', async () => {
  const { stream, chunks } = fakeOut()
  const p = new FakePlayer()
  const r = new Renderer(st(), p, stream as never)
  r.start()
  p.setPosition(1200)
  await sleep(80)
  r.stop()
  const n = chunks.length
  for (let i = 0; i < 4; i++) {
    p.setPosition(2000 + i * 300)
    await sleep(50)
  }
  assert.equal(chunks.length, n, 'sau stop không được vẽ thêm')
})

test('stop trả con trỏ về cho terminal', async () => {
  const { stream, chunks } = fakeOut()
  const r = new Renderer(st(), new FakePlayer(), stream as never)
  r.start()
  await sleep(60)
  r.stop()
  assert.ok(chunks.join('').includes('\x1b[?25h'), 'phải hiện lại con trỏ')
})

test('stop hai lần không lỗi', async () => {
  const { stream } = fakeOut()
  const r = new Renderer(st(), new FakePlayer(), stream as never)
  r.start()
  await sleep(40)
  r.stop()
  r.stop()
})

test('offset dịch vị trí đọc lời', async () => {
  const { stream, chunks } = fakeOut()
  const p = new FakePlayer()
  p.setPosition(3000)
  const r = new Renderer({ ...st(), offsetMs: -2000 }, p, stream as never)
  r.start()
  await sleep(80)
  r.stop()
  const out = stripAnsi(chunks.join(''))
  assert.ok(out.includes('one'), 'offset -2000 tại 3000ms phải đang ở câu "one"')
})

test('không vẽ lại khi khung hình y hệt khung trước', async () => {
  const { stream, chunks } = fakeOut()
  const p = new FakePlayer()
  p.setPosition(5000)
  const r = new Renderer(st(), p, stream as never)
  r.start()
  await sleep(300)
  r.stop()
  assert.ok(chunks.length < 8, `khung không đổi thì đừng vẽ lại, đã vẽ ${chunks.length} lần`)
})

test('đổi kích thước cửa sổ được ăn ngay', async () => {
  const { stream, chunks } = fakeOut()
  const p = new FakePlayer()
  p.setPosition(1500)
  const r = new Renderer(st(), p, stream as never)
  r.start()
  await sleep(80)
  stream.columns = 40
  p.setPosition(1600)
  await sleep(150)
  r.stop()
  const drawn = chunks.filter((c) => c.includes('\x1b[H'))
  const last = drawn.at(-1) ?? ''
  const widest = Math.max(...stripAnsi(last).split('\n').map((l) => l.length))
  assert.ok(widest <= 41, `khung sau khi co phải hẹp lại, đang là ${widest}`)
})

test('trạng thái paused của player được phản ánh lên khung', async () => {
  const { stream, chunks } = fakeOut()
  const p = new FakePlayer()
  p.setPosition(1500)
  p.pause()
  const r = new Renderer(st(), p, stream as never)
  r.start()
  await sleep(80)
  r.stop()
  assert.ok(/paused/i.test(stripAnsi(chunks.join(''))))
})
