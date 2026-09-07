import { createHash } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, extname, resolve as resolvePath } from 'node:path'
import { parseFile } from 'music-metadata'
import type { Track } from './types.ts'

export function expandPath(p: string): string {
  const expanded = p.startsWith('~') ? p.replace(/^~/, homedir()) : p
  return resolvePath(expanded)
}

export async function resolveLocal(inputPath: string): Promise<Track> {
  const path = expandPath(inputPath)
  if (!existsSync(path)) throw new Error(`Audio file not found: ${path}`)

  const meta = await parseFile(path)
  const title = meta.common.title?.trim() || basename(path, extname(path))
  const artist = meta.common.artist?.trim() || ''
  const durationMs = Math.round((meta.format.duration ?? 0) * 1000)

  // Băm theo realpath để symlink và đường dẫn tương đối cùng trỏ một cache.
  const sourceId = `local-${createHash('sha1').update(realpathSync(path)).digest('hex').slice(0, 16)}`

  return { audioPath: path, title, artist, durationMs, sourceId }
}
