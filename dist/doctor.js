import { execFile } from 'node:child_process';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ffmpegPath } from "./audio/ffmpeg-path.js";
import { cacheDir } from "./lyrics/store.js";
import { hasMpv } from "./audio/pick-player.js";
import { ytdlpVersionIfPresent } from "./resolver/ytdlp.js";
const execFileAsync = promisify(execFile);
const NODE_MIN = [22, 18];
function checkNode() {
    const [major, minor] = process.versions.node.split('.').map(Number);
    const ok = major > NODE_MIN[0] || (major === NODE_MIN[0] && minor >= NODE_MIN[1]);
    return {
        ok,
        label: 'Node',
        detail: `v${process.versions.node}`,
        hint: ok ? undefined : `klrc needs Node ${NODE_MIN.join('.')} or newer.`,
    };
}
function checkPlatform() {
    const ok = process.platform === 'darwin';
    return {
        ok,
        label: 'Platform',
        detail: `${process.platform} ${process.arch}`,
        hint: ok ? undefined : 'klrc supports macOS only for now.',
    };
}
async function checkFfmpeg() {
    if (!ffmpegPath) {
        return {
            ok: false,
            label: 'ffmpeg',
            detail: 'missing',
            hint: 'Reinstall klrc so npm can fetch the ffmpeg binary.',
        };
    }
    try {
        const { stdout } = await execFileAsync(ffmpegPath, ['-version'], { timeout: 20_000 });
        return { ok: true, label: 'ffmpeg', detail: stdout.split('\n')[0].replace('ffmpeg version ', 'v') };
    }
    catch {
        return {
            ok: false,
            label: 'ffmpeg',
            detail: 'will not run',
            hint: 'Reinstall klrc: npm i -g klrc',
        };
    }
}
async function checkYtdlp() {
    const version = await ytdlpVersionIfPresent();
    return {
        ok: true,
        label: 'yt-dlp',
        detail: version ? `v${version}` : 'not downloaded yet',
        hint: version ? undefined : 'It is fetched automatically on your first YouTube link.',
    };
}
async function checkMpv() {
    const present = await hasMpv();
    return {
        ok: true,
        label: 'mpv',
        detail: present ? 'installed — exact sync, seeking enabled' : 'not installed',
        hint: present
            ? undefined
            : 'Optional. With mpv, lyrics never drift and you can seek: brew install mpv',
    };
}
function dirSizeMb(dir) {
    if (!existsSync(dir))
        return 0;
    let total = 0;
    const walk = (d) => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, entry.name);
            if (entry.isDirectory())
                walk(p);
            else
                try {
                    total += statSync(p).size;
                }
                catch {
                    // File vừa bị xóa giữa lúc quét.
                }
        }
    };
    try {
        walk(dir);
    }
    catch {
        return 0;
    }
    return total / (1024 * 1024);
}
function checkCache() {
    const dir = cacheDir();
    const size = dirSizeMb(dir);
    return {
        ok: true,
        label: 'Cache',
        detail: `${dir} (${size.toFixed(1)} MB)`,
    };
}
async function checkLrclib() {
    try {
        const res = await fetch('https://lrclib.net/api/get?track_name=Shape%20of%20You&artist_name=Ed%20Sheeran&duration=234', { headers: { 'User-Agent': 'klrc/0.1.0 (https://github.com/klrc)' }, signal: AbortSignal.timeout(5000) });
        const ok = res.status === 200;
        return {
            ok,
            label: 'lrclib.net',
            detail: ok ? 'reachable' : `HTTP ${res.status}`,
            hint: ok ? undefined : 'Lyrics lookups will fail until this works.',
        };
    }
    catch {
        return {
            ok: false,
            label: 'lrclib.net',
            detail: 'unreachable',
            hint: 'Check your network; lyrics lookups need it (cached songs still play).',
        };
    }
}
export async function doctor() {
    const checks = [
        checkNode(),
        checkPlatform(),
        await checkFfmpeg(),
        await checkYtdlp(),
        await checkMpv(),
        await checkLrclib(),
        checkCache(),
    ];
    const width = Math.max(...checks.map((c) => c.label.length));
    const lines = ['', 'klrc doctor', ''];
    for (const c of checks) {
        lines.push(`  ${c.ok ? '✓' : '✗'}  ${c.label.padEnd(width)}  ${c.detail}`);
        if (c.hint)
            lines.push(`     ${' '.repeat(width)}  ${c.hint}`);
    }
    const failed = checks.filter((c) => !c.ok);
    lines.push('');
    lines.push(failed.length === 0 ? '  All good.' : `  ${failed.length} thing(s) need attention.`);
    lines.push('');
    return lines.join('\n');
}
//# sourceMappingURL=doctor.js.map