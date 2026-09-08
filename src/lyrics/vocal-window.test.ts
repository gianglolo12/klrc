import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vocalWindow } from './vocal-window.ts'
import type { Spectrum } from '../audio/spectrum-types.ts'

/** Dựng phổ nhân tạo: `loud` quyết định frame nào có tiếng hát. */
const build = (frameCount: number, loud: (i: number) => boolean): Spectrum => ({
  frameMs: 50,
  bands: 16,
  frames: Array.from({ length: frameCount }, (_, i) =>
    Uint8Array.from({ length: 16 }, (_, b) => {
      // Dải 8-13 là dải giọng người; dải khác giữ mức nền để chắc rằng hàm chỉ
      // đọc dải giọng chứ không đọc tổng năng lượng.
      const isVocalBand = b >= 8 && b <= 13
      if (!isVocalBand) return 200
      return loud(i) ? 230 : 10
    }),
  ),
})

test('hát ở nửa sau thì window co về nửa sau', () => {
  // 80 frame = 4000ms. Im 0-2000ms, hát 2000-4000ms.
  const sp = build(80, (i) => i >= 40)
  const w = vocalWindow(sp, 0, 4000)
  assert.ok(w.startMs >= 1800, `phải bắt đầu quanh 2000ms, nhận ${w.startMs}`)
  assert.ok(w.endMs > 3500, `phải kéo tới gần 4000ms, nhận ${w.endMs}`)
})

test('hát ở nửa đầu rồi nghỉ thì window co về nửa đầu', () => {
  const sp = build(80, (i) => i < 40)
  const w = vocalWindow(sp, 0, 4000)
  assert.ok(w.startMs < 400, `phải bắt đầu gần 0, nhận ${w.startMs}`)
  assert.ok(w.endMs <= 2300, `phải kết thúc quanh 2000ms, nhận ${w.endMs}`)
})

test('không bao giờ giãn ra ngoài khoảng gốc', () => {
  const sp = build(200, () => true)
  const w = vocalWindow(sp, 1000, 3000)
  assert.ok(w.startMs >= 1000)
  assert.ok(w.endMs <= 3000)
})

test('không co quá mức: luôn giữ lại phần lớn khoảng gốc', () => {
  // Chỉ 3 frame có tiếng giữa một khoảng dài — dò kiểu này dễ sai, nên phải
  // được chặn lại thay vì co xuống 150ms.
  const sp = build(80, (i) => i >= 40 && i < 43)
  const w = vocalWindow(sp, 0, 4000)
  const kept = (w.endMs - w.startMs) / 4000
  assert.ok(kept >= 0.35, `phải giữ >= 35% khoảng gốc, chỉ giữ ${(kept * 100).toFixed(0)}%`)
  assert.ok(kept < 1, 'nhưng vẫn phải co lại chút, không giữ nguyên cả khoảng')
})

test('im lặng hoàn toàn thì trả nguyên khoảng gốc', () => {
  const sp = build(80, () => false)
  const w = vocalWindow(sp, 0, 4000)
  assert.deepEqual(w, { startMs: 0, endMs: 4000 })
})

test('hát suốt thì trả nguyên khoảng gốc', () => {
  const sp = build(80, () => true)
  const w = vocalWindow(sp, 0, 4000)
  assert.deepEqual(w, { startMs: 0, endMs: 4000 })
})

test('phổ rỗng thì trả nguyên khoảng gốc, không nổ', () => {
  const empty: Spectrum = { frameMs: 50, bands: 16, frames: [] }
  assert.deepEqual(vocalWindow(empty, 500, 2500), { startMs: 500, endMs: 2500 })
})

test('khoảng nằm ngoài phạm vi phổ thì trả nguyên', () => {
  const sp = build(20, () => true)
  assert.deepEqual(vocalWindow(sp, 60000, 64000), { startMs: 60000, endMs: 64000 })
})

test('khoảng có độ dài 0 hoặc âm không sinh giá trị lạ', () => {
  const sp = build(80, (i) => i >= 40)
  const w = vocalWindow(sp, 2000, 2000)
  assert.ok(Number.isFinite(w.startMs) && Number.isFinite(w.endMs))
  assert.ok(w.endMs >= w.startMs)
})

test('chỉ đọc dải giọng, không bị tiếng trống ở dải trầm đánh lừa', () => {
  // Dải trầm gào lên từng nhịp, dải giọng im hẳn: không được coi là có hát.
  const sp: Spectrum = {
    frameMs: 50,
    bands: 16,
    frames: Array.from({ length: 80 }, (_, i) =>
      Uint8Array.from({ length: 16 }, (_, b) => (b <= 5 ? (i % 8 === 0 ? 255 : 40) : 10)),
    ),
  }
  assert.deepEqual(vocalWindow(sp, 0, 4000), { startMs: 0, endMs: 4000 })
})

test('đúng một nửa dòng có hát, với số frame lẻ, vẫn chọn đúng nửa có hát', () => {
  // Test hồi quy. Cách chọn ngưỡng bằng trung vị chạy đúng khi số frame chẵn
  // (trung vị rơi vào khoảng giữa hai mức), nhưng với số frame lẻ thì trung vị
  // rơi thẳng vào vùng đang hát, đẩy ngưỡng lên gần đỉnh và chọn ngược hẳn.
  // Đây là hình dạng dữ liệu thật: một dòng 6 giây, hát 3 giây đầu rồi nghỉ.
  const sp = build(121, (i) => i < 60)
  const w = vocalWindow(sp, 0, 6000)
  assert.ok(w.startMs < 500, `phải bắt đầu gần 0, nhận ${w.startMs}`)
  assert.ok(w.endMs <= 3600, `phải kết thúc quanh 3000ms, nhận ${w.endMs}`)
})

test('nửa sau có hát, số frame lẻ', () => {
  const sp = build(121, (i) => i >= 60)
  const w = vocalWindow(sp, 0, 6000)
  assert.ok(w.startMs >= 2500, `phải bắt đầu quanh 3000ms, nhận ${w.startMs}`)
  assert.ok(w.endMs > 5000, `phải kéo tới gần 6000ms, nhận ${w.endMs}`)
})

test('không tính frame của dòng kế tiếp vào window', () => {
  // Test hồi quy cho off-by-one. Phổ dài hơn dòng, và ngay sau dòng lại có
  // tiếng hát (dòng kế tiếp bắt đầu). Nếu hàm tính cả frame tại mốc kết thúc
  // thì window bị kéo tới hết dòng và cơ chế co thành vô nghĩa.
  //
  // Dòng [0, 6000] hát ở 0-3000; từ 6000 trở đi là dòng sau, cũng có hát.
  const sp = build(240, (i) => i < 60 || i >= 120)
  const w = vocalWindow(sp, 0, 6000)
  assert.ok(w.endMs <= 3600, `phải cắt quanh 3000ms, không kéo tới 6000 — nhận ${w.endMs}`)
})
