import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beatAt, dominantBand, pitchLevel } from './beat.ts'
import type { Spectrum } from '../audio/spectrum-types.ts'

/** Phổ có xung ở dải trầm mỗi `every` frame — mô phỏng tiếng trống kick. */
const withKick = (every: number, frameCount = 200): Spectrum => ({
  frameMs: 50,
  bands: 16,
  frames: Array.from({ length: frameCount }, (_, i) =>
    Uint8Array.from({ length: 16 }, (_, b) => {
      const isBass = b >= 1 && b <= 5
      if (!isBass) return 60
      return i % every === 0 ? 250 : 30
    }),
  ),
})

const flat = (level: number, frameCount = 100): Spectrum => ({
  frameMs: 50,
  bands: 16,
  frames: Array.from({ length: frameCount }, () => new Uint8Array(16).fill(level)),
})

test('beatAt trả giá trị trong khoảng 0-1', () => {
  const sp = withKick(8)
  for (let ms = 0; ms < 5000; ms += 37) {
    const v = beatAt(sp, ms)
    assert.ok(v >= 0 && v <= 1, `beat=${v} tại ${ms}ms phải nằm trong 0-1`)
  }
})

test('đúng nhịp trống thì beat cao hơn giữa hai nhịp', () => {
  const sp = withKick(8) // xung tại frame 0, 8, 16... tức 0ms, 400ms, 800ms
  const onBeat = beatAt(sp, 800)
  const offBeat = beatAt(sp, 1000) // frame 20, giữa hai xung
  assert.ok(onBeat > offBeat + 0.2, `on=${onBeat.toFixed(2)} off=${offBeat.toFixed(2)}`)
})

test('nhạc đều đều không có trống thì beat thấp và ổn định', () => {
  const sp = flat(120)
  const values = [0, 500, 1000, 1500, 2000].map((ms) => beatAt(sp, ms))
  assert.ok(Math.max(...values) < 0.5, `khong co xung thi beat phai thap: ${values}`)
})

test('phổ rỗng hoặc ngoài phạm vi trả 0, không nổ', () => {
  const empty: Spectrum = { frameMs: 50, bands: 16, frames: [] }
  assert.equal(beatAt(empty, 1000), 0)
  assert.equal(beatAt(withKick(8), 999_999), 0)
  assert.equal(beatAt(withKick(8), -500), 0)
})

test('dominantBand tìm đúng dải trội', () => {
  const sp: Spectrum = {
    frameMs: 50,
    bands: 16,
    frames: [
      Uint8Array.from({ length: 16 }, (_, b) => (b === 3 ? 250 : 20)),
      Uint8Array.from({ length: 16 }, (_, b) => (b === 12 ? 250 : 20)),
    ],
  }
  assert.equal(dominantBand(sp, 0), 3)
  assert.equal(dominantBand(sp, 50), 12)
})

test('dominantBand trả null khi không có dữ liệu', () => {
  const empty: Spectrum = { frameMs: 50, bands: 16, frames: [] }
  assert.equal(dominantBand(empty, 0), null)
  assert.equal(dominantBand(withKick(8), 999_999), null)
})

test('dominantBand trả null khi phổ phẳng, vì không có dải nào trội', () => {
  assert.equal(dominantBand(flat(100), 0), null)
})

/** Phổ dồn năng lượng vào một dải cố định. */
const atBand = (band: number, frameCount = 60): Spectrum => ({
  frameMs: 50,
  bands: 16,
  frames: Array.from({ length: frameCount }, () =>
    Uint8Array.from({ length: 16 }, (_, b) => (b === band ? 250 : 5)),
  ),
})

test('pitchLevel: dải trầm cho giá trị thấp, dải cao cho giá trị cao', () => {
  const low = pitchLevel(atBand(3), 1000)
  const high = pitchLevel(atBand(14), 1000)
  assert.ok(low !== null && high !== null)
  assert.ok(low! < 0.3, `dải trầm phải cho mức thấp, nhận ${low}`)
  assert.ok(high! > 0.7, `dải cao phải cho mức cao, nhận ${high}`)
})

test('pitchLevel luôn nằm trong 0-1', () => {
  for (const band of [0, 5, 10, 15]) {
    const v = pitchLevel(atBand(band), 1000)
    assert.ok(v !== null && v >= 0 && v <= 1, `dải ${band} cho ${v}`)
  }
})

test('pitchLevel được làm mượt: không nhảy giật giữa hai khung liền kề', () => {
  // Phổ đổi đột ngột từ dải trầm sang dải cao ở giữa.
  const sp: Spectrum = {
    frameMs: 50,
    bands: 16,
    frames: Array.from({ length: 60 }, (_, i) =>
      Uint8Array.from({ length: 16 }, (_, b) => (b === (i < 30 ? 2 : 14) ? 250 : 5)),
    ),
  }
  // Làm mượt nghĩa là giá trị đi qua nhiều bước trung gian, không nhảy một
  // bước từ đáy lên đỉnh ngay tại khung đổi.
  const atSwitch = pitchLevel(sp, 30 * 50)!
  const midway = pitchLevel(sp, 33 * 50)!
  const wellAfter = pitchLevel(sp, 40 * 50)!
  assert.ok(atSwitch < midway, `phải chuyển dần: ${atSwitch} -> ${midway}`)
  assert.ok(midway < wellAfter, `và tiếp tục lên: ${midway} -> ${wellAfter}`)
  assert.ok(midway > 0.2 && midway < 0.9, `mốc giữa phải ở lưng chừng, nhận ${midway}`)
})

test('pitchLevel trả null khi không có dữ liệu', () => {
  const empty: Spectrum = { frameMs: 50, bands: 16, frames: [] }
  assert.equal(pitchLevel(empty, 0), null)
  assert.equal(pitchLevel(atBand(5), 999_999), null)
  assert.equal(pitchLevel(atBand(5), -100), null)
})
