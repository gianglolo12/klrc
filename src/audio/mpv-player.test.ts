import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { MpvPlayer } from './mpv-player.ts'
import { hasMpv, pickPlayer } from './pick-player.ts'

const p = fileURLToPath(new URL('../resolver/fixtures/tone5s.mp3', import.meta.url))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Dọn mpv còn sót của klrc trước khi đo.
 *
 * Các test dưới đây đo thời gian thật trên thiết bị audio dùng chung: một tiến
 * trình mpv sót lại từ lần chạy trước đủ làm chúng trượt, và một suite đo thời
 * gian mà flaky thì không nói lên điều gì.
 */
try {
  execFileSync('pkill', ['-f', 'klrc-mpv-'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 300))
} catch {
  // pkill trả mã khác 0 khi không có tiến trình nào khớp — đó là trường hợp tốt.
}

const mpvAvailable = await hasMpv()
const skip = mpvAvailable ? false : 'mpv chưa được cài trên máy này'

test('hasMpv trả boolean, không ném lỗi khi thiếu mpv', async () => {
  assert.equal(typeof (await hasMpv()), 'boolean')
})

test('chỉ định afplay thì luôn được afplay', async () => {
  const pl = await pickPlayer(p, 'afplay')
  assert.equal(pl.label, 'afplay')
  assert.equal(pl.canSeek, false)
})

test('không chỉ định thì chọn được một player hợp lệ', async () => {
  const pl = await pickPlayer(p)
  assert.ok(['mpv', 'afplay'].includes(pl.label))
})

test('mpv: positionMs tiến lên và khớp thời gian thực', { skip }, async () => {
  const pl = new MpvPlayer(p)
  await pl.play()
  await sleep(700)
  const pos = pl.positionMs
  pl.stop()
  assert.ok(pos > 300 && pos < 1600, `pos = ${pos}, phải quanh 700ms`)
})

test('mpv: canSeek true và seek nhảy đúng vị trí', { skip }, async () => {
  const pl = new MpvPlayer(p)
  assert.equal(pl.canSeek, true)
  await pl.play()
  await sleep(400)
  pl.seek(3000)
  await sleep(300)
  const pos = pl.positionMs
  pl.stop()
  assert.ok(pos >= 2900 && pos < 4200, `sau khi tua tới 3s, pos = ${pos}`)
})

test('mpv: pause đóng băng vị trí, resume chạy tiếp', { skip }, async () => {
  const pl = new MpvPlayer(p)
  await pl.play()
  await sleep(400)
  pl.pause()
  const a = pl.positionMs
  await sleep(500)
  const b = pl.positionMs

  // Không so bằng tuyệt đối: sau khi pause, vòng đồng bộ vẫn lấy vị trí *thật*
  // từ mpv thay cho giá trị đang nội suy, nên con số nhích vài chục ms — đó là
  // hiệu chỉnh cho chính xác hơn, không phải nhạc chạy tiếp.
  assert.ok(Math.abs(b - a) < 150, `đang pause mà vị trí nhảy ${Math.abs(b - a)}ms`)

  pl.resume()
  await sleep(400)
  assert.ok(pl.positionMs > b + 200, 'resume phải chạy tiếp')
  pl.stop()
})

test('mpv: vị trí báo về sát vị trí thật, không lệch dần', { skip }, async () => {
  const pl = new MpvPlayer(p)
  const startedAt = Date.now()
  await pl.play()
  await sleep(2500)
  const drift = Math.abs(pl.positionMs - (Date.now() - startedAt))
  pl.stop()
  // Đây chính là điều afplay không làm được: mpv hỏi được vị trí thật nên sai
  // số không tích lũy theo bài.
  assert.ok(drift < 500, `lệch ${drift}ms so với đồng hồ, phải dưới 500ms`)
})

test('mpv: onEnd chạy khi hết bài', { skip }, async () => {
  const pl = new MpvPlayer(p)
  let ended = false
  pl.onEnd(() => {
    ended = true
  })
  await pl.play()
  await sleep(7000)
  pl.stop()
  assert.equal(ended, true)
})

test('mpv: stop hai lần không lỗi', { skip }, async () => {
  const pl = new MpvPlayer(p)
  await pl.play()
  pl.stop()
  pl.stop()
})
