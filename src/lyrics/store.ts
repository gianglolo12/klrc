import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Cache trên đĩa. Thư mục `lyrics/` là mặt tiếp xúc giữa Claude và CLI: CLI
 * đọc, Claude ghi. Không cần API, không cần IPC — chỉ là file.
 */

type Config = {
  offsets?: Record<string, number>
  last?: string
  theme?: string
}

export const cacheDir = (): string => process.env.KLRC_HOME ?? join(homedir(), '.klrc')

export const lrcPath = (sourceId: string): string => join(cacheDir(), 'lyrics', `${sourceId}.lrc`)
export const audioPath = (sourceId: string): string => join(cacheDir(), 'audio', `${sourceId}.m4a`)
export const spectrumPath = (sourceId: string): string =>
  join(cacheDir(), 'spectrum', `${sourceId}.json`)
const configPath = (): string => join(cacheDir(), 'config.json')

const ensureDirFor = (file: string): void => {
  mkdirSync(dirname(file), { recursive: true })
}

export function readText(file: string): string | null {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : null
  } catch {
    return null
  }
}

export function writeText(file: string, content: string): void {
  ensureDirFor(file)
  writeFileSync(file, content, 'utf8')
}

export const loadLrc = (sourceId: string): string | null => readText(lrcPath(sourceId))
export const saveLrc = (sourceId: string, lrc: string): void => writeText(lrcPath(sourceId), lrc)

/** Config hỏng thì coi như rỗng — ghi lần sau sẽ ghi đè hẳn nên file tự lành. */
function loadConfig(): Config {
  try {
    const raw = readText(configPath())
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Config) : {}
  } catch {
    return {}
  }
}

function saveConfig(cfg: Config): void {
  writeText(configPath(), `${JSON.stringify(cfg, null, 2)}\n`)
}

/**
 * Offset chỉ sống ở config.json, không bao giờ ghi vào .lrc — để Claude sửa lời
 * mà không ghi đè mất phần người dùng đã tự canh tay.
 */
export function loadOffset(sourceId: string): number {
  const v = loadConfig().offsets?.[sourceId]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function saveOffset(sourceId: string, ms: number): void {
  const cfg = loadConfig()
  cfg.offsets = { ...cfg.offsets, [sourceId]: ms }
  saveConfig(cfg)
}

/** Bài nghe gần nhất — để `klrc path --last` biết Claude cần sửa file nào. */
export function loadLast(): string | null {
  const v = loadConfig().last
  return typeof v === 'string' && v ? v : null
}

export function saveLast(sourceId: string): void {
  const cfg = loadConfig()
  cfg.last = sourceId
  saveConfig(cfg)
}
