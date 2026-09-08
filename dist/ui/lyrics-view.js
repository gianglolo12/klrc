/** Chỉ số câu đang hát, hoặc -1 khi nhạc còn ở đoạn dạo đầu. */
export function findActiveLine(lines, ms) {
    let found = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startMs <= ms)
            found = i;
        else
            break;
    }
    return found;
}
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
/**
 * Cắt câu thành phần đã hát và phần chưa hát tại mốc `ms`.
 *
 * Bất biến: `sung + unsung` luôn đúng bằng câu gốc, ở mọi giá trị `ms` kể cả
 * âm hay vượt quá câu — nếu vỡ bất biến này thì chữ sẽ nhảy hoặc mất khi tô.
 */
export function splitSung(words, ms) {
    if (words.length === 0)
        return { sung: '', unsung: '' };
    const full = words.map((w) => w.text).join(' ');
    let cut = 0;
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (ms >= w.endMs) {
            // Từ này xong hẳn. Khoảng trắng theo sau cũng tính là đã hát, để con trỏ
            // tô không đứng lửng lơ trước dấu cách trong lúc chờ từ kế tiếp.
            cut += w.text.length + (i < words.length - 1 ? 1 : 0);
            continue;
        }
        if (ms <= w.startMs)
            break;
        const ratio = clamp((ms - w.startMs) / Math.max(w.endMs - w.startMs, 1), 0, 1);
        cut += Math.round(ratio * w.text.length);
        break;
    }
    cut = clamp(cut, 0, full.length);
    return { sung: full.slice(0, cut), unsung: full.slice(cut) };
}
//# sourceMappingURL=lyrics-view.js.map