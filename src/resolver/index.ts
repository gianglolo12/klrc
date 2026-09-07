import { resolveLocal } from './local.ts'
import { resolveYoutube } from './youtube.ts'
import type { Track } from './types.ts'

const YOUTUBE = /^https?:\/\/([\w-]+\.)*(youtube\.com|youtu\.be)\//i

/**
 * Chỉ nhận diện YouTube; mọi thứ khác coi là đường dẫn file, kể cả link của
 * dịch vụ khác — lỗi "Audio file not found: <link>" nói rõ vấn đề hơn là một
 * lỗi tải nhạc mơ hồ.
 */
export const classifyInput = (input: string): 'youtube' | 'local' =>
  YOUTUBE.test(input.trim()) ? 'youtube' : 'local'

export const resolve = (input: string): Promise<Track> =>
  classifyInput(input) === 'youtube' ? resolveYoutube(input) : resolveLocal(input)

export type { Track }
