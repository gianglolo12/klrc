export type Spectrum = {
  /** Khoảng thời gian mỗi frame, ms. Cố định 50 để tra mảng theo đồng hồ. */
  frameMs: number
  /** Số dải tần mỗi frame. Cố định 16. */
  bands: number
  /** Mỗi frame là `bands` giá trị 0-255. */
  frames: Uint8Array[]
}
