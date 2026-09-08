/**
 * Client cho lrclib.net — cơ sở dữ liệu lời bài hát mở, không cần API key.
 *
 * Tra hai bước vì tỉ lệ tìm thấy bài phụ thuộc hoàn toàn vào khâu này:
 * `/api/get` khớp chính xác trước, trượt thì `/api/search` rồi lọc theo độ dài.
 */
const BASE = 'https://lrclib.net';
const UA = 'klrc/0.1.0 (https://github.com/klrc)';
const TIMEOUT_MS = 10_000;
/** Bản remix/live/sped-up cùng tên nhưng khác độ dài sẽ lệch nhịp cả bài. */
const MAX_DURATION_DRIFT_MS = 3000;
async function getJson(url, fetchImpl) {
    const res = await fetchImpl(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status !== 200)
        return null;
    return await res.json();
}
function fromRecord(rec) {
    if (rec.instrumental)
        return { kind: 'none' };
    if (rec.syncedLyrics)
        return { kind: 'synced', lrc: rec.syncedLyrics };
    if (rec.plainLyrics)
        return { kind: 'plain', text: rec.plainLyrics };
    return { kind: 'none' };
}
export async function fetchLyrics(q, fetchImpl = globalThis.fetch) {
    try {
        const params = new URLSearchParams({
            track_name: q.title,
            artist_name: q.artist,
            duration: String(Math.round(q.durationMs / 1000)),
        });
        const exact = (await getJson(`${BASE}/api/get?${params}`, fetchImpl));
        if (exact) {
            const r = fromRecord(exact);
            if (r.kind !== 'none')
                return r;
        }
        const search = new URLSearchParams({ q: `${q.title} ${q.artist}`.trim() });
        const list = (await getJson(`${BASE}/api/search?${search}`, fetchImpl));
        if (!Array.isArray(list))
            return { kind: 'none' };
        // Chỉ giữ bản có timing và độ dài khớp; trong đó chọn bản lệch ít nhất.
        const candidates = list
            .filter((r) => r.syncedLyrics && typeof r.duration === 'number')
            .map((r) => ({ rec: r, drift: Math.abs(r.duration * 1000 - q.durationMs) }))
            .filter((c) => c.drift <= MAX_DURATION_DRIFT_MS)
            .sort((a, b) => a.drift - b.drift);
        if (candidates.length > 0)
            return fromRecord(candidates[0].rec);
        // Không bản nào khớp độ dài — chấp nhận lời không timing nếu có.
        const plain = list.find((r) => r.plainLyrics && !r.instrumental);
        if (plain)
            return { kind: 'plain', text: plain.plainLyrics };
        return { kind: 'none' };
    }
    catch {
        // Mất mạng, timeout, JSON hỏng — người dùng chỉ cần biết là không có lời.
        return { kind: 'none' };
    }
}
//# sourceMappingURL=lrclib.js.map