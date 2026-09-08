import { existsSync } from 'node:fs';
import { parseFile } from 'music-metadata';
import { cleanTitle } from "../lyrics/clean-title.js";
import { audioPath as cachedAudioPath } from "../lyrics/store.js";
import { ytdlp } from "./ytdlp.js";
/** yt-dlp báo lỗi bằng văn xuôi; dịch thành câu người dùng hiểu được. */
const ERROR_MAP = [
    [/private video/i, 'This video is private.'],
    [/not available in your country|geo.?restrict/i, 'This video is blocked in your region.'],
    [/video unavailable/i, 'This video is unavailable.'],
    [/sign in to confirm/i, 'YouTube is asking for sign-in on this video.'],
    [/members.?only|join this channel/i, 'This video is for channel members only.'],
    [/is not a valid URL|unsupported url/i, 'That does not look like a YouTube link.'],
];
export function friendlyError(err) {
    const parts = err instanceof Error
        ? [err.message, err.stderr ?? '']
        : [String(err)];
    const raw = parts.join('\n');
    for (const [pattern, message] of ERROR_MAP) {
        if (pattern.test(raw))
            return new Error(message);
    }
    // Dòng ERROR của yt-dlp nói rõ hơn dòng đầu của stack trace.
    const errorLine = raw.split('\n').find((l) => /^ERROR:/.test(l.trim()));
    const firstLine = raw.split('\n').find((l) => l.trim().length > 0);
    const detail = (errorLine ?? firstLine ?? 'unknown error').replace(/^ERROR:\s*/, '').trim();
    return new Error(`Could not download audio: ${detail}`);
}
export function videoIdFrom(url) {
    try {
        const u = new URL(url);
        const fromQuery = u.searchParams.get('v');
        if (fromQuery)
            return fromQuery;
        const fromPath = u.pathname.split('/').filter(Boolean).pop();
        if (fromPath)
            return fromPath;
    }
    catch {
        // URL không parse được thì rơi xuống lỗi bên dưới.
    }
    throw new Error(`Could not read a video id from: ${url}`);
}
export async function resolveYoutube(url, onProgress) {
    const sourceId = `yt-${videoIdFrom(url)}`;
    const path = cachedAudioPath(sourceId);
    let info;
    try {
        onProgress?.('Reading video info...');
        const { stdout } = await ytdlp(['--dump-single-json', '--no-warnings', '--no-playlist', url], onProgress);
        info = JSON.parse(stdout);
    }
    catch (err) {
        throw friendlyError(err);
    }
    if (!existsSync(path)) {
        try {
            onProgress?.('Downloading audio...');
            await ytdlp([
                // Tai thang luong m4a co san thay vi '--extract-audio': chuyen ma can
                // ffmpeg, ma ffmpeg la tuy chon o day.
                '-f',
                'bestaudio[ext=m4a]/bestaudio',
                '--output',
                path,
                '--no-playlist',
                '--no-warnings',
                '--no-progress',
                url,
            ], onProgress);
        }
        catch (err) {
            throw friendlyError(err);
        }
    }
    const cleaned = cleanTitle(info.title ?? '');
    const artist = cleaned.artist ?? info.uploader ?? info.channel ?? '';
    // Ưu tiên độ dài đọc từ file: yt-dlp báo độ dài video, còn LRCLIB so theo độ
    // dài bản audio, và hai số này lệch nhau ở nhiều MV.
    let durationMs = Math.round((info.duration ?? 0) * 1000);
    try {
        const meta = await parseFile(path);
        if (meta.format.duration)
            durationMs = Math.round(meta.format.duration * 1000);
    }
    catch {
        // Giữ độ dài từ yt-dlp.
    }
    return { audioPath: path, title: cleaned.title, artist, durationMs, sourceId };
}
//# sourceMappingURL=youtube.js.map