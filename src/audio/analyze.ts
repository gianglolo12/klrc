import { spawn } from 'node:child_process'
import { ffmpegPath } from './ffmpeg-path.ts'
import { readText, spectrumPath, writeText } from '../lyrics/store.ts'
import { fft } from './fft.ts'
import type { Spectrum } from './spectrum-types.ts'

/**
 * Phổ nhạc tính trước cho cả bài.
 *
 * Terminal không đọc được âm thanh đang phát, nên thay vì phân tích realtime,
 * phân tích một lần rồi tra mảng theo đồng hồ khi phát: CPU gần bằng 0 và phổ
 * khớp nhạc chính xác vì nó không đoán.
 */

/** 8kHz đủ cho 16 dải hiển thị, và giảm mạnh khối lượng decode. */
const SAMPLE_RATE = 8000
/** FFT cần luỹ thừa của 2; 512 mẫu ở 8kHz là 64ms — đủ mịn cho mắt. */
const WINDOW = 512
export const FRAME_MS = 50
const HOP = (SAMPLE_RATE * FRAME_MS) / 1000
const BANDS = 16
/**
 * Dải động hiển thị, tính từ đỉnh của bài xuống. 45dB cho phổ nhảy rõ mà vẫn
 * còn chỗ trống ở dải yếu — hẹp hơn thì bão hòa, rộng hơn thì lẹt đẹt.
 */
const DYNAMIC_RANGE_DB = 45

/** Cửa sổ Hann, tính trước vì dùng lại cho mọi frame. */
const HANN = Float64Array.from({ length: WINDOW }, (_, i) =>
  0.5 * (1 - Math.cos((2 * Math.PI * i) / (WINDOW - 1))),
)

/**
 * Biên các dải chia theo thang log: tai người nghe theo log, nên chia đều làm
 * dải thấp dồn cục một chỗ và dải cao gần như trống trơn.
 */
const BAND_EDGES = ((): number[] => {
  const bins = WINDOW / 2
  const minBin = 1
  const edges: number[] = []
  for (let b = 0; b <= BANDS; b++) {
    const t = b / BANDS
    edges.push(Math.round(minBin * (bins / minBin) ** t))
  }
  return edges
})()

function decodePcm(audioPath: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg binary is missing; reinstall klrc'))
      return
    }

    const bin: string = ffmpegPath
    const proc = spawn(bin, [
      '-v', 'quiet',
      '-i', audioPath,
      '-f', 'f32le',
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-',
    ])

    const chunks: Buffer[] = []
    let stderr = ''
    proc.stdout.on('data', (c: Buffer) => chunks.push(c))
    proc.stderr.on('data', (c: Buffer) => {
      stderr += c.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed to decode audio (exit ${code}) ${stderr}`.trim()))
        return
      }
      const buf = Buffer.concat(chunks)
      if (buf.length < WINDOW * 4) {
        reject(new Error('ffmpeg produced no usable audio data'))
        return
      }
      // Buffer của Node có thể không align 4 byte cho Float32Array, nên copy.
      const samples = new Float32Array(buf.length >> 2)
      for (let i = 0; i < samples.length; i++) samples[i] = buf.readFloatLE(i * 4)
      resolve(samples)
    })
  })
}

function computeFrames(samples: Float32Array): Uint8Array[] {
  const re = new Float64Array(WINDOW)
  const im = new Float64Array(WINDOW)

  // Lượt 1: lấy biên độ thô từng dải và tìm đỉnh của cả bài.
  const raw: Float64Array[] = []
  let loudest = 0

  for (let start = 0; start + WINDOW <= samples.length; start += HOP) {
    for (let i = 0; i < WINDOW; i++) {
      re[i] = samples[start + i] * HANN[i]
      im[i] = 0
    }
    fft(re, im)

    const bands = new Float64Array(BANDS)
    for (let b = 0; b < BANDS; b++) {
      const from = BAND_EDGES[b]
      const to = Math.max(BAND_EDGES[b + 1], from + 1)

      let peak = 0
      for (let k = from; k < to && k < WINDOW / 2; k++) {
        const mag = Math.hypot(re[k], im[k])
        if (mag > peak) peak = mag
      }
      bands[b] = peak
      if (peak > loudest) loudest = peak
    }
    raw.push(bands)
  }

  // Lượt 2: đổi sang dB *tương đối với đỉnh của chính bài này*.
  //
  // Ngưỡng dB tuyệt đối không dùng được: nhạc thương mại đã master rất to nên
  // mọi dải đều vượt ngưỡng và phổ biến thành một khối đặc. Chuẩn hóa theo bài
  // giúp phổ luôn có biên độ nhìn thấy, dù bài to hay nhỏ.
  const reference = loudest > 0 ? loudest : 1
  return raw.map((bands) => {
    const frame = new Uint8Array(BANDS)
    for (let b = 0; b < BANDS; b++) {
      const db = 20 * Math.log10(bands[b] / reference + 1e-9)
      const scaled = ((db + DYNAMIC_RANGE_DB) / DYNAMIC_RANGE_DB) * 255
      frame[b] = Math.max(0, Math.min(255, Math.round(scaled)))
    }
    return frame
  })
}

type CachedSpectrum = { frameMs: number; bands: number; frames: number[][] }

function loadCache(sourceId: string): Spectrum | null {
  const raw = readText(spectrumPath(sourceId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedSpectrum
    if (!Array.isArray(parsed.frames) || parsed.bands !== BANDS) return null
    return {
      frameMs: parsed.frameMs,
      bands: parsed.bands,
      frames: parsed.frames.map((f) => Uint8Array.from(f)),
    }
  } catch {
    // Cache hỏng thì tính lại; ghi lần sau sẽ ghi đè hẳn.
    return null
  }
}

export async function analyze(audioPath: string, sourceId: string): Promise<Spectrum> {
  const cached = loadCache(sourceId)
  if (cached) return cached

  const samples = await decodePcm(audioPath)
  const frames = computeFrames(samples)
  const spectrum: Spectrum = { frameMs: FRAME_MS, bands: BANDS, frames }

  const payload: CachedSpectrum = {
    frameMs: spectrum.frameMs,
    bands: spectrum.bands,
    frames: frames.map((f) => Array.from(f)),
  }
  writeText(spectrumPath(sourceId), JSON.stringify(payload))

  return spectrum
}
