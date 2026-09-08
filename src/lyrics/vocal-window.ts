import type { Spectrum } from '../audio/spectrum-types.ts'
import type { Window } from './interpolate.ts'

/**
 * Dò đoạn thật sự có tiếng hát trong khoảng của một dòng lời.
 *
 * Vì sao cần: LRCLIB chỉ cho mốc *bắt đầu* mỗi dòng, nên khoảng của một dòng
 * được coi là kéo tới lúc dòng sau bắt đầu. Thực tế ca sĩ thường hát xong rồi
 * nghỉ, nên nếu rải chữ đều khắp khoảng đó thì nửa cuối câu lúc nào cũng tô
 * chậm hơn tiếng hát. Chia lại tỉ lệ không sửa được; phải biết khi nào có tiếng.
 *
 * Dùng phổ nhạc đã tính trước cho cả bài, nên không tốn thêm gì lúc chạy.
 */

/**
 * Dải 8-13 trong 16 dải log ≈ 250Hz-2kHz — vùng năng lượng giọng người.
 *
 * Cố tình bỏ dải trầm (0-7): tiếng trống kick nằm ở đó và sẽ khiến mọi nhịp
 * trông như có người hát. Cũng bỏ dải cao nhất (14-15): hi-hat và cymbal.
 */
const VOCAL_BAND_LO = 8
const VOCAL_BAND_HI = 13

/**
 * Luôn giữ lại ít nhất phần này của khoảng gốc.
 *
 * Việc dò có thể sai — nhạc phối dày, giọng bị nhạc lấn. Chặn lại nghĩa là khi
 * dò sai thì tệ nhất cũng chỉ gần hành vi cũ, không bao giờ tệ hơn.
 *
 * 35% chứ không phải một con số cao hơn: hát nửa câu rồi nghỉ là chuyện bình
 * thường, và một sàn cao sẽ chặn đúng cái trường hợp cần co nhất.
 */
const MIN_KEEP_RATIO = 0.35

/**
 * Ngưỡng "có hát", tính tuyến tính giữa sàn và đỉnh của chính dòng này.
 *
 * KHÔNG dùng trung vị: khi đúng một nửa dòng có hát — trường hợp phổ biến nhất —
 * trung vị rơi ngay vào vùng đang hát, đẩy ngưỡng lên gần đỉnh, và hàm chỉ bắt
 * được một đỉnh nhiễu rồi kết luận ngược hẳn vùng cần chọn.
 */
const THRESHOLD_RATIO = 0.35

/**
 * Tương phản tối thiểu giữa đỉnh và sàn để dám kết luận.
 *
 * Dòng hát liên tục có năng lượng gần như phẳng; không có ngưỡng này thì một
 * gợn nhỏ cũng bị coi là ranh giới im/hát và dòng bị co bừa.
 */
const MIN_CONTRAST = 0.25

export function vocalWindow(spectrum: Spectrum, startMs: number, endMs: number): Window {
  const fallback: Window = { startMs, endMs }
  if (spectrum.frames.length === 0 || endMs <= startMs) return fallback

  const firstFrame = Math.max(Math.floor(startMs / spectrum.frameMs), 0)
  // -1 vì frame thứ `ceil(endMs/frameMs)` bắt đầu ĐÚNG tại mốc kết thúc, tức nó
  // thuộc dòng kế tiếp — nơi ca sĩ đã hát lại. Tính nó vào sẽ kéo window tới
  // hết dòng, đúng cái mà hàm này phải cắt.
  const lastFrame = Math.min(
    Math.ceil(endMs / spectrum.frameMs) - 1,
    spectrum.frames.length - 1,
  )
  if (lastFrame <= firstFrame) return fallback

  // Năng lượng dải giọng cho từng frame trong khoảng.
  const energy: number[] = []
  for (let i = firstFrame; i <= lastFrame; i++) {
    const frame = spectrum.frames[i]
    let sum = 0
    for (let b = VOCAL_BAND_LO; b <= VOCAL_BAND_HI && b < frame.length; b++) sum += frame[b]
    energy.push(sum)
  }

  const lo = Math.min(...energy)
  const hi = Math.max(...energy)
  if (hi <= 0 || hi <= lo) return fallback

  // Không đủ tương phản thì coi như hát liên tục, đừng co bừa.
  if ((hi - lo) / hi < MIN_CONTRAST) return fallback

  // Ngưỡng theo chính dòng này, không theo cả bài: đoạn hát nhỏ trong bài to
  // vẫn phải dò được.
  const threshold = lo + (hi - lo) * THRESHOLD_RATIO

  let firstLoud = -1
  let lastLoud = -1
  for (let i = 0; i < energy.length; i++) {
    if (energy[i] < threshold) continue
    if (firstLoud === -1) firstLoud = i
    lastLoud = i
  }
  if (firstLoud === -1) return fallback

  let from = Math.max((firstFrame + firstLoud) * spectrum.frameMs, startMs)
  // +1 để trùm hết frame cuối có tiếng thay vì cắt ngay ở mốc bắt đầu của nó.
  let to = Math.min((firstFrame + lastLoud + 1) * spectrum.frameMs, endMs)

  const span = endMs - startMs
  const minSpan = span * MIN_KEEP_RATIO
  if (to - from < minSpan) {
    // Nới đều hai phía quanh tâm đoạn đã dò, rồi đẩy vào trong khoảng gốc nếu
    // tràn ra — giữ tâm chứ không kéo lệch về một phía.
    const center = (from + to) / 2
    from = center - minSpan / 2
    to = center + minSpan / 2

    if (from < startMs) {
      from = startMs
      to = Math.min(startMs + minSpan, endMs)
    }
    if (to > endMs) {
      to = endMs
      from = Math.max(endMs - minSpan, startMs)
    }
  }

  return { startMs: Math.round(from), endMs: Math.round(to) }
}
