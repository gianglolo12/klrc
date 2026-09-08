/**
 * Đếm âm tiết của một từ.
 *
 * Dùng để chia thời gian một dòng cho từng chữ. Cách cũ chia theo số ký tự,
 * và nó sai hệ thống với tiếng Việt: tiếng Việt đơn âm, mỗi tiếng một âm tiết
 * và hát gần bằng nhau, nên chia theo ký tự khiến tiếng dài chiếm tới gấp đôi
 * thời gian tiếng ngắn — chữ tô nhanh chậm lệch nhau suốt bài.
 *
 * Đếm nhóm nguyên âm giải quyết cả hai ngôn ngữ cùng lúc: cấu trúc âm tiết
 * tiếng Việt luôn cho đúng một nhóm mỗi tiếng, còn tiếng Anh vẫn phân biệt
 * được từ dài với từ ngắn nhưng theo âm tiết chứ không theo chính tả.
 */
/** Bỏ dấu thanh và dấu phụ, để nguyên âm tiếng Việt rơi về a/e/i/o/u/y. */
const stripDiacritics = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const VOWEL_GROUPS = /[aeiouy]+/g;
export function countSyllables(word) {
    const cleaned = stripDiacritics(word.toLowerCase())
        // Bỏ dấu câu bám quanh từ, giữ lại chữ và số.
        .replace(/[^a-z0-9đ]/g, '');
    if (!cleaned)
        return 1;
    // Chữ `e` cuối từ trong tiếng Anh thường không thành âm tiết ("make", "time").
    // Tiếng Việt không có từ nào mất âm tiết vì luật này, nên áp dụng được cho cả hai.
    const withoutSilentE = cleaned.length > 2 ? cleaned.replace(/e$/, '') : cleaned;
    const groups = withoutSilentE.match(VOWEL_GROUPS);
    return Math.max(groups ? groups.length : 1, 1);
}
//# sourceMappingURL=syllables.js.map