import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.KLRC_HOME = mkdtempSync(join(tmpdir(), 'klrc-an-'))
const { analyze } = await import('./analyze.ts')
const p = fileURLToPath(new URL('../resolver/fixtures/tone5s.mp3', import.meta.url))

test('sinh spectrum có số frame khớp độ dài bài', async () => {
  const s = await analyze(p, 'test-tone')
  assert.equal(s.frameMs, 50)
  assert.equal(s.bands, 16)
  // 5 giây / 50ms = 100 frame; cho phép lệch chút do encoder mp3.
  assert.ok(Math.abs(s.frames.length - 100) < 15, `có ${s.frames.length} frame, mong quanh 100`)
  assert.equal(s.frames[0].length, 16)
})

test('mọi giá trị nằm trong 0-255 và không NaN', async () => {
  const s = await analyze(p, 'test-range')
  for (const f of s.frames) {
    for (const v of f) {
      assert.ok(Number.isFinite(v) && v >= 0 && v <= 255, `giá trị lạ: ${v}`)
    }
  }
})

test('tone 440Hz cho đỉnh ở đúng dải chứa nó, các dải khác im', async () => {
  const s = await analyze(p, 'test-tone-2')
  const mid = s.frames[Math.floor(s.frames.length / 2)]

  // 440Hz ở 8kHz với cửa sổ 512 mẫu nằm ở bin 440/(8000/512) ≈ 28. Với 16 dải
  // chia theo thang log, bin 28 thuộc dải 9 — dải giữa, không phải dải thấp.
  const peakBand = Array.from(mid).indexOf(Math.max(...mid))
  assert.equal(peakBand, 9, `đỉnh phải ở dải 9, đang ở ${peakBand}: [${Array.from(mid)}]`)

  // Tone thuần thì các dải xa phải gần như im — nếu không, cửa sổ Hann hoặc
  // phần chia dải đang rò năng lượng.
  const far = [0, 1, 2, 14, 15].map((b) => mid[b])
  assert.ok(
    far.every((v) => v < mid[peakBand] / 2),
    `dải xa phải im hơn nửa đỉnh: đỉnh=${mid[peakBand]} xa=[${far}]`,
  )
})

test('lần hai đọc từ cache, không chạy lại ffmpeg', async () => {
  const t0 = Date.now()
  await analyze(p, 'test-cache')
  const first = Date.now() - t0
  const t1 = Date.now()
  await analyze(p, 'test-cache')
  const second = Date.now() - t1
  assert.ok(second < first / 2 + 30, `cache phải nhanh hơn rõ rệt: ${first}ms rồi ${second}ms`)
})

test('cache trả về đúng dữ liệu đã lưu', async () => {
  const a = await analyze(p, 'test-same')
  const b = await analyze(p, 'test-same')
  assert.equal(a.frames.length, b.frames.length)
  assert.deepEqual(Array.from(a.frames[10]), Array.from(b.frames[10]))
})

test('cache hỏng thì tính lại, không nổ', async () => {
  mkdirSync(join(process.env.KLRC_HOME!, 'spectrum'), { recursive: true })
  writeFileSync(join(process.env.KLRC_HOME!, 'spectrum', 'test-broken.json'), 'rác')
  const s = await analyze(p, 'test-broken')
  assert.ok(s.frames.length > 0)
})

test('file audio không tồn tại -> ném lỗi, không treo', async () => {
  await assert.rejects(() => analyze('/khong/ton/tai.mp3', 'test-missing'))
})

test.after(() => rmSync(process.env.KLRC_HOME!, { recursive: true, force: true }))
