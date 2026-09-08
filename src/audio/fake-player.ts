import type { Player } from './player.ts'

/**
 * Player giả cho test: vị trí do test đặt, không phát tiếng.
 *
 * Đây là mấu chốt để test được animation — `renderFrame` thành hàm thuần khi
 * vị trí phát là thứ ta điều khiển, nên khung hình so được với snapshot.
 */
export class FakePlayer implements Player {
  readonly canSeek = true
  readonly label = 'fake'

  private pos = 0
  private paused = false

  setPosition(ms: number): void {
    this.pos = ms
  }

  get positionMs(): number {
    return this.pos
  }

  get isPaused(): boolean {
    return this.paused
  }

  async play(): Promise<void> {}

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  seek(ms: number): void {
    this.pos = ms
  }

  stop(): void {}

  onEnd(_cb: () => void): void {}
}
