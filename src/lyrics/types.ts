export type Word = { startMs: number; endMs: number; text: string }

export type Line = {
  startMs: number
  endMs: number
  text: string
  words: Word[]
}

export type Lyrics = {
  lines: Line[]
  hasTiming: boolean
  offsetMs: number
}
