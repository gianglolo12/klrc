import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderFrame, type ViewState } from './frame.ts'
import { stripAnsi } from './theme.ts'
import { parseLrc } from '../lyrics/parser.ts'
import { interpolateWords } from '../lyrics/interpolate.ts'

const lrc = `[00:01.00] first line here
[00:04.00] second line goes on
[00:07.00] third line arrives
[00:10.00] fourth and final line`

const state = (): ViewState => {
  const lyrics = parseLrc(lrc)
  lyrics.lines.forEach((l) => {
    l.words = interpolateWords(l)
  })
  return {
    title: 'Test Song',
    artist: 'Test Artist',
    lyrics,
    spectrum: null,
    durationMs: 15000,
    playerLabel: 'afplay',
    canSeek: false,
    offsetMs: 0,
    paused: false,
  }
}

const plain = (s: string) => stripAnsi(s)

test('khung hình không vượt quá chiều rộng cho trước', () => {
  for (const w of [40, 60, 80, 120]) {
    const out = plain(renderFrame(state(), 5000, w, 24))
    for (const line of out.split('\n')) {
      assert.ok(line.length <= w, `rộng ${w}: dòng dài ${line.length} — "${line}"`)
    }
  }
})

test('khung hình không vượt quá chiều cao cho trước', () => {
  for (const h of [8, 12, 24, 40]) {
    const n = renderFrame(state(), 5000, 80, h).split('\n').length
    assert.ok(n <= h, `cao ${h} nhưng ra ${n} dòng`)
  }
})

test('câu đang hát xuất hiện, câu chưa tới cũng thấy', () => {
  const out = plain(renderFrame(state(), 5000, 80, 24))
  assert.ok(out.includes('second line'), 'phải thấy câu đang hát')
  assert.ok(out.includes('third line'), 'phải thấy câu kế tiếp')
})

test('có tiêu đề, nghệ sĩ, nhãn player và thời gian', () => {
  const out = plain(renderFrame(state(), 5000, 80, 24))
  assert.ok(out.includes('Test Song'))
  assert.ok(out.includes('Test Artist'))
  assert.ok(out.includes('afplay'))
  assert.ok(out.includes('0:05'))
})

test('canSeek false thì không quảng cáo phím tua', () => {
  const out = plain(renderFrame(state(), 5000, 80, 24))
  assert.ok(!/seek/i.test(out), 'afplay không tua được, đừng hiện phím tua')
})

test('canSeek true thì hiện phím tua', () => {
  const s = { ...state(), canSeek: true, playerLabel: 'mpv' }
  assert.ok(/seek/i.test(plain(renderFrame(s, 5000, 80, 24))))
})

test('trước câu đầu tiên vẫn vẽ được, không nổ', () => {
  assert.ok(plain(renderFrame(state(), 0, 80, 24)).includes('first line'))
})

test('sau câu cuối vẫn vẽ được', () => {
  assert.ok(plain(renderFrame(state(), 14000, 80, 24)).includes('fourth and final'))
})

test('vị trí âm (offset đẩy lùi quá đầu bài) không nổ', () => {
  assert.doesNotThrow(() => renderFrame(state(), -3000, 80, 24))
})

test('lời không có timing -> nói rõ cho người dùng', () => {
  const s = state()
  s.lyrics.hasTiming = false
  assert.ok(/no timing/i.test(plain(renderFrame(s, 5000, 80, 24))))
})

test('terminal hẹp 40 cột vẫn giữ được lời', () => {
  const out = plain(renderFrame(state(), 5000, 40, 20))
  assert.ok(out.includes('second line'), 'hẹp thì bỏ hiệu ứng, không bỏ lời')
})

test('terminal rất thấp 8 dòng vẫn giữ được lời', () => {
  const out = plain(renderFrame(state(), 5000, 80, 8))
  assert.ok(out.includes('second line'))
})

test('paused thì hiện dấu tạm dừng', () => {
  assert.ok(/paused/i.test(plain(renderFrame({ ...state(), paused: true }, 5000, 80, 24))))
})

test('offset khác 0 thì hiển thị', () => {
  assert.ok(plain(renderFrame({ ...state(), offsetMs: -250 }, 5000, 80, 24)).includes('-0.25'))
})

test('cùng input cho ra cùng output', () => {
  assert.equal(renderFrame(state(), 5000, 80, 24), renderFrame(state(), 5000, 80, 24))
})

test('câu dài hơn chiều rộng bị cắt, không tràn dòng', () => {
  const s = state()
  s.lyrics.lines[1].text = 'x'.repeat(200)
  s.lyrics.lines[1].words = interpolateWords({ ...s.lyrics.lines[1], words: [] })
  const out = plain(renderFrame(s, 5000, 60, 24))
  for (const line of out.split('\n')) assert.ok(line.length <= 60)
})

test('có spectrum thì vẽ, terminal hẹp thì bỏ', () => {
  const sp = {
    frameMs: 50,
    bands: 16,
    frames: Array.from({ length: 300 }, () => Uint8Array.from({ length: 16 }, () => 200)),
  }
  const wide = plain(renderFrame({ ...state(), spectrum: sp }, 5000, 80, 24))
  assert.ok(/[▁▂▃▄▅▆▇█]/.test(wide), 'rộng 80 thì phải có spectrum')
  const narrow = plain(renderFrame({ ...state(), spectrum: sp }, 5000, 50, 24))
  assert.ok(!/[▁▂▃▄▅▆▇█]/.test(narrow), 'rộng 50 thì bỏ spectrum')
})

test('lời rỗng hoàn toàn không làm nổ', () => {
  const s = state()
  s.lyrics.lines = []
  assert.doesNotThrow(() => renderFrame(s, 5000, 80, 24))
})

/** Bỏ dòng header: nhãn player ở đó cũng chứa ký tự ●. */
const body = (f: string) => plain(f).split('\n').slice(1).join('\n')

test('quãng nhạc dạo dài thì khung hình có dấu đếm ngược', () => {
  const s = state()
  // Câu đầu ở 1s; đẩy nó ra 12s để có quãng dạo đủ dài.
  s.lyrics.lines[0].startMs = 12000
  s.lyrics.lines[0].endMs = 14000
  const out = body(renderFrame(s, 9000, 80, 24))
  assert.ok(out.includes('●'), `phải có dấu đếm ngược:\n${out}`)
})

test('đang hát giữa câu thì không có dấu đếm ngược', () => {
  const out = body(renderFrame(state(), 5000, 80, 24))
  assert.ok(!out.includes('●'), 'đang hát thì đừng chen dấu đếm vào')
})

test('gradient đổi tông theo tiến độ bài, không đứng im', () => {
  const early = renderFrame(state(), 1000, 80, 24)
  const late = renderFrame(state(), 14000, 80, 24)
  const colorOf = (f: string) => (f.match(/\x1b\[1;38;5;(\d+)m/) ?? [])[1]
  // Khi terminal không bật màu (test chạy qua pipe) thì bỏ qua phép so này.
  if (colorOf(early)) assert.notEqual(colorOf(early), colorOf(late))
})
