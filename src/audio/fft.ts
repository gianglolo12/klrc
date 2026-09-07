/**
 * Cooley-Tukey radix-2, biến đổi tại chỗ.
 *
 * Tự viết thay vì thêm dependency: chỉ cần một biến đổi thuận trên mảng thực,
 * chạy một lần cho mỗi bài rồi cache — không đáng để kéo thêm một package.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  if (im.length !== n) throw new Error('FFT input arrays must have the same length')
  if (n === 0 || (n & (n - 1)) !== 0) throw new Error('FFT length must be a power of two')
  if (n === 1) return

  // Đảo bit chỉ số: xếp lại mẫu để các tầng butterfly bên dưới chạy tại chỗ.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      const half = len >> 1

      for (let k = 0; k < half; k++) {
        const aRe = re[i + k]
        const aIm = im[i + k]
        const bRe = re[i + k + half] * curRe - im[i + k + half] * curIm
        const bIm = re[i + k + half] * curIm + im[i + k + half] * curRe

        re[i + k] = aRe + bRe
        im[i + k] = aIm + bIm
        re[i + k + half] = aRe - bRe
        im[i + k + half] = aIm - bIm

        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}
