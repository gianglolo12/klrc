import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { AfplayPlayer } from './afplay-player.ts'

const p = fileURLToPath(new URL('../resolver/fixtures/tone5s.mp3', import.meta.url))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('positionMs bằng 0 trước khi play', () => {
  assert.equal(new AfplayPlayer(p).positionMs, 0)
})

test('positionMs tiến lên sau khi play', async () => {
  const pl = new AfplayPlayer(p)
  await pl.play()
  await sleep(350)
  const pos = pl.positionMs
  pl.stop()
  assert.ok(pos >= 250 && pos < 900, `pos = ${pos}, phải quanh 350ms`)
})

test('pause đóng băng positionMs, resume chạy tiếp', async () => {
  const pl = new AfplayPlayer(p)
  await pl.play()
  await sleep(200)
  pl.pause()
  const a = pl.positionMs
  await sleep(250)
  const b = pl.positionMs
  assert.equal(a, b, 'đang pause thì vị trí không được nhích')
  pl.resume()
  await sleep(200)
  assert.ok(pl.positionMs > b, 'resume phải chạy tiếp')
  pl.stop()
})

test('canSeek false và seek không làm nổ', async () => {
  const pl = new AfplayPlayer(p)
  assert.equal(pl.canSeek, false)
  await pl.play()
  pl.seek(3000)
  assert.ok(pl.positionMs < 1000, 'seek phải bị bỏ qua, không nhảy vị trí')
  pl.stop()
})

test('onEnd chạy khi hết bài', async () => {
  const pl = new AfplayPlayer(p)
  let ended = false
  pl.onEnd(() => {
    ended = true
  })
  await pl.play()
  await sleep(6500)
  assert.equal(ended, true)
})

test('stop rồi onEnd không được gọi', async () => {
  const pl = new AfplayPlayer(p)
  let ended = false
  pl.onEnd(() => {
    ended = true
  })
  await pl.play()
  await sleep(150)
  pl.stop()
  await sleep(400)
  assert.equal(ended, false, 'người dùng tự thoát thì không tính là hết bài')
})

test('stop hai lần không lỗi', async () => {
  const pl = new AfplayPlayer(p)
  await pl.play()
  pl.stop()
  pl.stop()
})

test('label là afplay', () => {
  assert.equal(new AfplayPlayer(p).label, 'afplay')
})
