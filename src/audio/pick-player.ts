import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { AfplayPlayer } from './afplay-player.ts'
import { MpvPlayer } from './mpv-player.ts'
import type { Player } from './player.ts'

const execFileAsync = promisify(execFile)

export type PlayerChoice = 'mpv' | 'afplay'

export async function hasMpv(): Promise<boolean> {
  try {
    await execFileAsync('which', ['mpv'])
    return true
  } catch {
    return false
  }
}

/**
 * mpv nếu có (đồng bộ thật, tua được), không thì afplay (luôn có trên macOS).
 *
 * Giao diện đọc `player.label` và `player.canSeek` để chỉ hiện những phím thật
 * sự dùng được — người dùng không bấm mãi một phím vô tác dụng.
 */
export async function pickPlayer(audioPath: string, which?: PlayerChoice): Promise<Player> {
  if (which === 'afplay') return new AfplayPlayer(audioPath)

  if (which === 'mpv') {
    if (!(await hasMpv())) {
      throw new Error('mpv not found. Install it with: brew install mpv')
    }
    return new MpvPlayer(audioPath)
  }

  return (await hasMpv()) ? new MpvPlayer(audioPath) : new AfplayPlayer(audioPath)
}
