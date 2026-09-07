/**
 * Mặt tiếp xúc duy nhất giữa lớp giao diện và việc phát nhạc.
 *
 * Vì `ui/` chỉ đọc `positionMs`, một Player giả biến toàn bộ animation thành
 * thứ test được — và mpv với afplay thay thế nhau mà giao diện không biết gì.
 */
export interface Player {
  play(): Promise<void>
  pause(): void
  resume(): void
  /** Không hỗ trợ thì im lặng bỏ qua, không ném lỗi. */
  seek(ms: number): void
  readonly positionMs: number
  readonly isPaused: boolean
  readonly canSeek: boolean
  /** Tên hiện ở góc màn hình, để người dùng biết vì sao tua được hay không. */
  readonly label: string
  stop(): void
  /** Chỉ gọi khi bài chạy hết, không gọi khi người dùng tự thoát. */
  onEnd(cb: () => void): void
}
