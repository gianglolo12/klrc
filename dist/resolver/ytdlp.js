import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { cacheDir } from "../lyrics/store.js";
/**
 * Quản binary yt-dlp.
 *
 * Không dùng `youtube-dl-exec`: nó chỉ tải bản yt-dlp dạng zip Python, cần
 * Python >= 3.10 trên máy người dùng. macOS xuất xưởng với Python 3.9, nên
 * phần lớn người dùng sẽ gặp `ImportError` ngay lần chạy đầu.
 *
 * Bản `yt-dlp_macos` là binary self-contained (PyInstaller) — không cần Python.
 * Tải một lần vào cache, kiểm SHA-256 đối chiếu file checksum của cùng release
 * trước khi cho phép chạy.
 */
const execFileAsync = promisify(execFile);
const RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';
const BINARY_URL = `${RELEASE}/yt-dlp_macos`;
const CHECKSUM_URL = `${RELEASE}/SHA2-256SUMS`;
const CHECKSUM_NAME = 'yt-dlp_macos';
const cachedBinary = () => join(cacheDir(), 'bin', 'yt-dlp');
async function runsOk(path) {
    try {
        await execFileAsync(path, ['--version'], { timeout: 20_000 });
        return true;
    }
    catch {
        return false;
    }
}
async function inPath() {
    try {
        const { stdout } = await execFileAsync('which', ['yt-dlp']);
        const path = stdout.trim();
        return path && (await runsOk(path)) ? path : null;
    }
    catch {
        return null;
    }
}
/** Lấy SHA-256 mong đợi từ file checksum của chính release đó. */
async function expectedHash() {
    const res = await fetch(CHECKSUM_URL, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok)
        throw new Error(`Could not fetch yt-dlp checksums (HTTP ${res.status})`);
    for (const line of (await res.text()).split('\n')) {
        const [hash, name] = line.trim().split(/\s+/);
        if (name === CHECKSUM_NAME && hash)
            return hash.toLowerCase();
    }
    throw new Error(`Checksum for ${CHECKSUM_NAME} not found in release checksums`);
}
async function download(dest, onProgress) {
    onProgress?.('Downloading yt-dlp (one-time, ~40 MB)...');
    const want = await expectedHash();
    const res = await fetch(BINARY_URL, { signal: AbortSignal.timeout(300_000) });
    if (!res.ok)
        throw new Error(`Could not download yt-dlp (HTTP ${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const got = createHash('sha256').update(bytes).digest('hex');
    if (got !== want) {
        throw new Error(`yt-dlp checksum mismatch (expected ${want}, got ${got}). Aborting.`);
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, bytes);
    chmodSync(dest, 0o755);
    onProgress?.('yt-dlp ready.');
}
let resolved = null;
/** Đường dẫn tới yt-dlp chạy được, tải về nếu cần. Kết quả được nhớ trong tiến trình. */
export async function ytdlpPath(onProgress) {
    if (resolved)
        return resolved;
    const override = process.env.KLRC_YTDLP;
    if (override) {
        if (!(await runsOk(override)))
            throw new Error(`KLRC_YTDLP is not runnable: ${override}`);
        resolved = override;
        return resolved;
    }
    const system = await inPath();
    if (system) {
        resolved = system;
        return resolved;
    }
    const cached = cachedBinary();
    if (existsSync(cached) && (await runsOk(cached))) {
        resolved = cached;
        return resolved;
    }
    await download(cached, onProgress);
    if (!(await runsOk(cached)))
        throw new Error('Downloaded yt-dlp does not run on this machine.');
    resolved = cached;
    return resolved;
}
export async function ytdlp(args, onProgress) {
    const bin = await ytdlpPath(onProgress);
    const { stdout, stderr } = await execFileAsync(bin, args, {
        maxBuffer: 64 * 1024 * 1024,
        timeout: 600_000,
    });
    return { stdout, stderr };
}
/** Đọc phiên bản, phục vụ `klrc doctor`. Không tải về nếu chưa có. */
export async function ytdlpVersionIfPresent() {
    const candidates = [process.env.KLRC_YTDLP, cachedBinary()].filter(Boolean);
    const system = await inPath();
    if (system)
        candidates.unshift(system);
    for (const path of candidates) {
        try {
            const { stdout } = await execFileAsync(path, ['--version'], { timeout: 20_000 });
            return stdout.trim();
        }
        catch {
            // thử ứng viên tiếp theo
        }
    }
    return null;
}
//# sourceMappingURL=ytdlp.js.map