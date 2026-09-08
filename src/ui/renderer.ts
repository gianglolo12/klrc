import type { Player } from '../audio/player.ts'
import { renderFrame, type ViewState } from './frame.ts'
import { CLEAR_BELOW, CLEAR_LINE, HIDE_CURSOR, HOME, SHOW_CURSOR } from './theme.ts'

/** 30fps: đủ mượt để chữ tô liền mạch, đủ rẻ để không hâm nóng CPU. */
const FRAME_INTERVAL_MS = 33

type OutStream = {
  write(s: string): boolean
  columns?: number
  rows?: number
}

export class Renderer {
  private readonly state: ViewState
  private readonly player: Player
  private readonly out: OutStream

  private timer: NodeJS.Timeout | null = null
  private lastFrame: string | null = null
  private running = false

  constructor(state: ViewState, player: Player, out: OutStream) {
    this.state = state
    this.player = player
    this.out = out
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.out.write(HIDE_CURSOR)
    this.draw()
    this.timer = setInterval(() => this.draw(), FRAME_INTERVAL_MS)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.out.write(`${SHOW_CURSOR}\n`)
  }

  /** Cho phép CLI đổi offset khi người dùng bấm `[` `]` mà không dựng lại renderer. */
  setOffset(ms: number): void {
    this.state.offsetMs = ms
  }

  private draw(): void {
    if (!this.running) return

    const width = this.out.columns ?? 80
    const height = this.out.rows ?? 24
    this.state.paused = this.player.isPaused

    const positionMs = this.player.positionMs + this.state.offsetMs
    const frame = renderFrame(this.state, positionMs, width, height)

    // Đoạn nhạc dạo và lúc tạm dừng cho ra khung y hệt nhau; bỏ qua việc ghi
    // giúp terminal khỏi nhấp nháy và tiết kiệm phần lớn I/O của cả bài.
    if (frame === this.lastFrame) return
    this.lastFrame = frame

    // Xoá phần dư từng dòng thay vì xoá cả màn hình: xoá cả màn gây nháy.
    const painted = frame
      .split('\n')
      .map((line) => line + CLEAR_LINE)
      .join('\n')
    this.out.write(HOME + painted + CLEAR_BELOW)
  }
}
