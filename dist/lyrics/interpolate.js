/**
 * Sàn thời gian mỗi từ. Không có nó, một câu 40 từ trong 1 giây sẽ cho những từ
 * dài 25ms — nhanh hơn cả một khung hình, mắt chỉ thấy cả câu sáng cùng lúc.
 */
const MIN_WORD_MS = 60;
/**
 * Suy ra timing từng chữ từ timing của cả dòng.
 *
 * LRCLIB không bao giờ cho timing từng chữ (đã kiểm trên nhiều bài phổ biến),
 * nên đây là đường chính chứ không phải dự phòng.
 *
 * Chia theo trọng số độ dài từ thay vì chia đều: chia đều làm "a" sáng lâu
 * bằng "wonderful", nhìn là thấy sai nhịp ngay. Số ký tự là xấp xỉ rẻ và đủ tốt
 * cho số âm tiết.
 */
export function interpolateWords(line) {
    if (line.words.length > 0)
        return line.words;
    const tokens = line.text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0)
        return [];
    // +1 cho mỗi từ: mô phỏng khoảng nghỉ giữa các từ, và giữ cho từ một ký tự
    // không bị vụt qua quá nhanh.
    const weights = tokens.map((t) => t.length + 1);
    const total = weights.reduce((a, b) => a + b, 0);
    const span = Math.max(line.endMs - line.startMs, 0);
    const words = [];
    let cursor = line.startMs;
    for (let i = 0; i < tokens.length; i++) {
        const dur = Math.max(Math.round((span * weights[i]) / total), MIN_WORD_MS);
        words.push({ startMs: cursor, endMs: cursor + dur, text: tokens[i] });
        cursor += dur;
    }
    // Khớp lại đúng mốc kết thúc của dòng, nhưng chỉ khi việc đó không làm từ cuối
    // co lại thành âm (xảy ra khi sàn MIN_WORD_MS đã đẩy cursor vượt endMs).
    const last = words.at(-1);
    if (line.endMs >= last.startMs)
        last.endMs = line.endMs;
    return words;
}
//# sourceMappingURL=interpolate.js.map