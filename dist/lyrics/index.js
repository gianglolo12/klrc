import { interpolateWords } from "./interpolate.js";
import { fetchLyrics } from "./lrclib.js";
import { parseLrc } from "./parser.js";
import { loadLrc, loadOffset, saveLrc } from "./store.js";
export class LyricsNotFoundError extends Error {
    title;
    artist;
    constructor(title, artist) {
        super(`No lyrics found for "${title}"${artist ? ` by ${artist}` : ''}`);
        this.name = 'LyricsNotFoundError';
        this.title = title;
        this.artist = artist;
    }
}
/** Lời không có timing: vẫn xem được, chỉ không chạy karaoke. */
function plainLyrics(text) {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((t) => ({ startMs: 0, endMs: 0, text: t, words: [] }));
    return { lines, hasTiming: false, offsetMs: 0 };
}
/**
 * Lấy lời cho một bài: cache trước, mạng sau.
 *
 * Đọc cache trước không chỉ để nhanh — đó là cách lời Claude đã sửa được dùng
 * đến thay cho bản gốc trên LRCLIB.
 */
export async function getLyricsFor(track) {
    const cached = loadLrc(track.sourceId);
    const lyrics = cached
        ? parseLrc(cached)
        : await (async () => {
            const result = await fetchLyrics({
                title: track.title,
                artist: track.artist,
                durationMs: track.durationMs,
            });
            if (result.kind === 'synced') {
                saveLrc(track.sourceId, result.lrc);
                return parseLrc(result.lrc);
            }
            if (result.kind === 'plain')
                return plainLyrics(result.text);
            throw new LyricsNotFoundError(track.title, track.artist);
        })();
    for (const line of lyrics.lines) {
        line.words = interpolateWords(line);
    }
    lyrics.offsetMs = loadOffset(track.sourceId);
    return lyrics;
}
//# sourceMappingURL=index.js.map