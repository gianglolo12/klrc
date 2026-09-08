import type { Spectrum } from '../audio/spectrum-types.ts'

/**
 * Đọc nhịp và cao độ từ phổ nhạc đã tính trước.
 *
 * Không phân tích âm thanh ở đây — phổ đã có sẵn cho cả bài, nên hai hàm này
 * chỉ là phép tra mảng, đủ rẻ để gọi 30 lần mỗi giây.
 */

/**
 * Dải 1-5 trong 16 dải log ≈ 15-125Hz — vùng tiếng trống kick và bass.
 *
 * Bỏ dải 0 vì nó chứa thành phần một chiều và tiếng ù, luôn cao nên làm nhoè
 * mọi thứ.
 */
const BASS_BAND_LO = 1
const BASS_BAND_HI = 5

/** Cửa sổ so sánh để biết "cao so với xung quanh": 1.5 giây mỗi phía. */
const CONTEXT_FRAMES = 30

/** Dưới mức này coi như không có dải nào trội hơn phần còn lại. */
const DOMINANCE_MARGIN = 1.35

/**
 * Làm mượt trọng tâm phổ qua 300ms.
 *
 * Không làm mượt thì màu chữ giật từng khung; mắt đọc lời sẽ bị phá.
 */
const PITCH_SMOOTH_FRAMES = 6

/**
 * Phạm vi trọng tâm phổ thực tế của nhạc, đo trên bài thật: phân vị 10 ở dải
 * ~6.5 và phân vị 90 ở ~10.6 trên thang 16 dải. Map bằng phạm vi này thay vì
 * 0-15 để màu dùng hết thang thay vì kẹt ở khoảng giữa.
 */
const PITCH_LO = 5.5
const PITCH_HI = 11.5

const bassEnergy = (spectrum: Spectrum, frameIndex: number): number => {
  const frame = spectrum.frames[frameIndex]
  if (!frame) return 0
  let sum = 0
  for (let b = BASS_BAND_LO; b <= BASS_BAND_HI && b < frame.length; b++) sum += frame[b]
  return sum
}

/**
 * Cường độ nhịp tại thời điểm đang phát, 0 đến 1.
 *
 * Tính tương đối với vùng xung quanh chứ không theo ngưỡng tuyệt đối: bài phối
 * dày lúc nào cũng nhiều năng lượng trầm, nên ngưỡng tuyệt đối sẽ luôn bằng 1
 * và hiệu ứng đứng im.
 */
export function beatAt(spectrum: Spectrum, positionMs: number): number {
  if (spectrum.frames.length === 0 || positionMs < 0) return 0

  const index = Math.floor(positionMs / spectrum.frameMs)
  if (index < 0 || index >= spectrum.frames.length) return 0

  const here = bassEnergy(spectrum, index)
  if (here === 0) return 0

  const from = Math.max(index - CONTEXT_FRAMES, 0)
  const to = Math.min(index + CONTEXT_FRAMES, spectrum.frames.length - 1)

  let lo = Infinity
  let hi = 0
  for (let i = from; i <= to; i++) {
    const value = bassEnergy(spectrum, i)
    if (value < lo) lo = value
    if (value > hi) hi = value
  }
  if (hi <= lo) return 0

  return Math.min(Math.max((here - lo) / (hi - lo), 0), 1)
}

/** Trọng tâm phổ của một frame, tính theo chỉ số dải. */
const centroid = (spectrum: Spectrum, frameIndex: number): number | null => {
  const frame = spectrum.frames[frameIndex]
  if (!frame || frame.length === 0) return null
  let weighted = 0
  let total = 0
  for (let b = 0; b < frame.length; b++) {
    weighted += b * frame[b]
    total += frame[b]
  }
  return total > 0 ? weighted / total : null
}

/**
 * Cao độ tổng thể tại thời điểm đang phát, 0 (trầm) đến 1 (cao), hoặc `null`
 * khi không có dữ liệu.
 *
 * Dùng trọng tâm phổ chứ không dùng dải trội: dải trội nhảy rời rạc khắp thang
 * nên màu chữ giật từng khung, còn trọng tâm dịch mượt theo nhạc. Làm mượt thêm
 * qua 300ms để bỏ những gợn ngắn.
 */
export function pitchLevel(spectrum: Spectrum, positionMs: number): number | null {
  if (spectrum.frames.length === 0 || positionMs < 0) return null

  const index = Math.floor(positionMs / spectrum.frameMs)
  if (index < 0 || index >= spectrum.frames.length) return null

  let sum = 0
  let count = 0
  const from = Math.max(index - PITCH_SMOOTH_FRAMES + 1, 0)
  for (let i = from; i <= index; i++) {
    const value = centroid(spectrum, i)
    if (value !== null) {
      sum += value
      count++
    }
  }
  if (count === 0) return null

  const average = sum / count
  const ratio = (average - PITCH_LO) / (PITCH_HI - PITCH_LO)
  return Math.min(Math.max(ratio, 0), 1)
}

/**
 * Dải tần trội tại thời điểm đang phát, hoặc `null` khi phổ phẳng.
 *
 * Giữ lại cho việc chẩn đoán; giao diện dùng `pitchLevel` vì nó mượt hơn.
 */
export function dominantBand(spectrum: Spectrum, positionMs: number): number | null {
  if (spectrum.frames.length === 0 || positionMs < 0) return null

  const index = Math.floor(positionMs / spectrum.frameMs)
  const frame = spectrum.frames[index]
  if (!frame || frame.length === 0) return null

  let best = 0
  let bestValue = -1
  let total = 0
  for (let b = 0; b < frame.length; b++) {
    total += frame[b]
    if (frame[b] > bestValue) {
      bestValue = frame[b]
      best = b
    }
  }

  const average = total / frame.length
  if (average <= 0 || bestValue < average * DOMINANCE_MARGIN) return null

  return best
}
