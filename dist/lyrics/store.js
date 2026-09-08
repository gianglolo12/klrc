import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
export const cacheDir = () => process.env.KLRC_HOME ?? join(homedir(), '.klrc');
export const lrcPath = (sourceId) => join(cacheDir(), 'lyrics', `${sourceId}.lrc`);
export const audioPath = (sourceId) => join(cacheDir(), 'audio', `${sourceId}.m4a`);
export const spectrumPath = (sourceId) => join(cacheDir(), 'spectrum', `${sourceId}.json`);
const configPath = () => join(cacheDir(), 'config.json');
const ensureDirFor = (file) => {
    mkdirSync(dirname(file), { recursive: true });
};
export function readText(file) {
    try {
        return existsSync(file) ? readFileSync(file, 'utf8') : null;
    }
    catch {
        return null;
    }
}
export function writeText(file, content) {
    ensureDirFor(file);
    writeFileSync(file, content, 'utf8');
}
export const loadLrc = (sourceId) => readText(lrcPath(sourceId));
export const saveLrc = (sourceId, lrc) => writeText(lrcPath(sourceId), lrc);
/** Config hỏng thì coi như rỗng — ghi lần sau sẽ ghi đè hẳn nên file tự lành. */
function loadConfig() {
    try {
        const raw = readText(configPath());
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
}
function saveConfig(cfg) {
    writeText(configPath(), `${JSON.stringify(cfg, null, 2)}\n`);
}
/**
 * Offset chỉ sống ở config.json, không bao giờ ghi vào .lrc — để Claude sửa lời
 * mà không ghi đè mất phần người dùng đã tự canh tay.
 */
export function loadOffset(sourceId) {
    const v = loadConfig().offsets?.[sourceId];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
export function saveOffset(sourceId, ms) {
    const cfg = loadConfig();
    cfg.offsets = { ...cfg.offsets, [sourceId]: ms };
    saveConfig(cfg);
}
/** Bài nghe gần nhất — để `klrc path --last` biết Claude cần sửa file nào. */
export function loadLast() {
    const v = loadConfig().last;
    return typeof v === 'string' && v ? v : null;
}
export function saveLast(sourceId) {
    const cfg = loadConfig();
    cfg.last = sourceId;
    saveConfig(cfg);
}
//# sourceMappingURL=store.js.map