import { interpolateWords } from "./interpolate.js";
import { vocalWindow } from "./vocal-window.js";
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
 * Rải timing từng chữ cho mọi dòng.
 *
 * Tách khỏi `getLyricsFor` vì bước này cần phổ nhạc, mà phổ được tính song song
 * với việc tra lời — ghép ở đây, sau khi cả hai việc đã xong.
 *
 * Có phổ thì mỗi dòng được co về đoạn thật sự có tiếng hát trước khi rải chữ;
 * không có phổ (ffmpeg thiếu, phân tích lỗi) thì rải đều cả dòng như trước.
 */
export function alignWords(lyrics, spectrum) {
    for (const line of lyrics.lines) {
        if (!lyrics.hasTiming) {
            line.words = [];
            continue;
        }
        const window = spectrum ? vocalWindow(spectrum, line.startMs, line.endMs) : undefined;
        line.words = interpolateWords(line, window);
    }
}
/**
 * Lấy lời cho một bài: cache trước, mạng sau.
 *
 * Đọc cache trước không chỉ để nhanh — đó là cách lời Claude đã sửa được dùng
 * đến thay cho bản gốc trên LRCLIB.
 *
 * Chưa rải timing từng chữ ở đây — gọi `alignWords` sau khi có phổ nhạc.
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
    lyrics.offsetMs = loadOffset(track.sourceId);
    return lyrics;
}
//# sourceMappingURL=index.js.map