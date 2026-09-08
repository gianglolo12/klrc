import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
/**
 * Tìm ffmpeg trên máy.
 *
 * Không dùng `ffmpeg-static`: package đó tải binary bằng install script, mà npm
 * từ bản 11.16 chặn install script theo mặc định — cả lệnh `npm i -g klrc` thất
 * bại với `exit -2`, nên app coi như không cài được. Bỏ nó đi thì klrc không còn
 * dependency nào cần chạy script lúc cài.
 *
 * ffmpeg chỉ dùng để phân tích phổ nhạc. Thiếu nó thì mất phổ, karaoke vẫn chạy
 * bình thường — đúng nguyên tắc: hiệu ứng chết thì bỏ hiệu ứng, đừng bỏ bài hát.
 */
const CANDIDATES = [
    '/opt/homebrew/bin/ffmpeg', // Apple Silicon
    '/usr/local/bin/ffmpeg', // Intel
    '/opt/local/bin/ffmpeg', // MacPorts
];
function runs(path) {
    try {
        execFileSync(path, ['-version'], { stdio: 'ignore', timeout: 20_000 });
        return true;
    }
    catch {
        return false;
    }
}
function fromPath() {
    try {
        const found = execFileSync('which', ['ffmpeg'], { encoding: 'utf8', timeout: 10_000 }).trim();
        return found && runs(found) ? found : null;
    }
    catch {
        return null;
    }
}
function discover() {
    const override = process.env.KLRC_FFMPEG;
    if (override)
        return runs(override) ? override : null;
    const inPath = fromPath();
    if (inPath)
        return inPath;
    for (const candidate of CANDIDATES) {
        if (existsSync(candidate) && runs(candidate))
            return candidate;
    }
    return null;
}
let cached;
/** `null` khi máy không có ffmpeg. Kết quả được nhớ trong tiến trình. */
export function findFfmpeg() {
    if (cached === undefined)
        cached = discover();
    return cached;
}
export const FFMPEG_HINT = 'Install it for the spectrum display: brew install ffmpeg';
//# sourceMappingURL=ffmpeg-path.js.map