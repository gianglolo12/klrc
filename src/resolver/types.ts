export type Track = {
  audioPath: string
  title: string
  artist: string
  durationMs: number
  /** Khóa cache: `local-<hash>` hoặc `yt-<videoId>`. */
  sourceId: string
}
