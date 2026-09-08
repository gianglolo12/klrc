/** Khoảng thời gian gán cho câu cuối, vì không có câu sau để suy ra endMs. */
const LAST_LINE_MS = 5000;
const TIMESTAMP = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;
const WORD_STAMP = /<(\d+):(\d+)(?:[.:](\d+))?>\s*([^<]*)/g;
/** `[ti:...]`, `[ar:...]`, `[offset:...]` — metadata, không phải câu hát. */
const META_TAG = /^\[[a-z]{2,}:[^\]]*\]$/i;
/** `.5` -> 500ms, `.65` -> 650ms, `.250` -> 250ms */
const fracToMs = (frac) => frac ? Number(frac.padEnd(3, '0').slice(0, 3)) : 0;
const toMs = (min, sec, frac) => Number(min) * 60_000 + Number(sec) * 1000 + fracToMs(frac);
/** Tách timing từng chữ của enhanced LRC. Trả mảng rỗng nếu dòng không có. */
function parseWords(body, lineEndMs) {
    const found = [];
    for (const m of body.matchAll(WORD_STAMP)) {
        const text = m[4].trim();
        if (text)
            found.push({ startMs: toMs(m[1], m[2], m[3]), text });
    }
    return found.map((w, i) => ({
        startMs: w.startMs,
        endMs: found[i + 1]?.startMs ?? lineEndMs,
        text: w.text,
    }));
}
export function parseLrc(text) {
    const raw = [];
    let sawTimestamp = false;
    const untimed = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || META_TAG.test(line))
            continue;
        const stamps = [...line.matchAll(TIMESTAMP)];
        if (stamps.length === 0) {
            untimed.push(line);
            continue;
        }
        sawTimestamp = true;
        // Bỏ mọi timestamp đầu dòng, phần còn lại là nội dung câu.
        const body = line.replace(TIMESTAMP, '').trim();
        // Một câu có thể mang nhiều mốc (điệp khúc lặp lại) — nhân thành nhiều dòng.
        for (const s of stamps)
            raw.push({ startMs: toMs(s[1], s[2], s[3]), body });
    }
    if (!sawTimestamp) {
        return {
            lines: untimed.map((t) => ({ startMs: 0, endMs: 0, text: t, words: [] })),
            hasTiming: false,
            offsetMs: 0,
        };
    }
    raw.sort((a, b) => a.startMs - b.startMs);
    const lines = [];
    for (let i = 0; i < raw.length; i++) {
        const endMs = raw[i + 1]?.startMs ?? raw[i].startMs + LAST_LINE_MS;
        const words = parseWords(raw[i].body, endMs);
        // Với enhanced LRC, text lấy lại từ các word để bỏ hết mốc `<mm:ss.xx>`.
        const textValue = words.length > 0 ? words.map((w) => w.text).join(' ') : raw[i].body;
        if (!textValue)
            continue;
        lines.push({ startMs: raw[i].startMs, endMs, text: textValue, words });
    }
    return { lines, hasTiming: true, offsetMs: 0 };
}
//# sourceMappingURL=parser.js.map