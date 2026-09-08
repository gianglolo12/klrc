/**
 * Tiêu đề YouTube gần như luôn bẩn: `"Tên bài | Official MV [4K]"`, tên kênh
 * thay cho tên nghệ sĩ. Tra thẳng chuỗi đó vào LRCLIB là trượt, và đó là nguyên
 * nhân "không tìm thấy lời" phổ biến nhất.
 */
/** Các từ chỉ mô tả bản phát hành, không thuộc tên bài. */
const JUNK = /^(4k|8k|hd|hq|official|official\s+(video|mv|m\/v|audio|lyric\s*video|visualizer)|mv|m\/v|lyrics?|lyric\s*video|audio|video|visualizer|full|full\s+album|remaster(ed)?(\s*\d{2,4})?|explicit)$/i;
/** Phần trước dấu gạch dài hơn mức này thì không phải tên nghệ sĩ. */
const MAX_ARTIST_LEN = 40;
const isJunk = (s) => JUNK.test(s.trim());
export function cleanTitle(raw) {
    // Phần sau dấu | luôn là mô tả kênh hoặc quảng cáo.
    let s = raw.split('|')[0];
    // Bỏ (...) và [...] nếu bên trong chỉ là mô tả bản phát hành.
    s = s.replace(/[([]([^)\]]*)[)\]]/g, (all, inner) => (isJunk(inner) ? '' : all));
    s = s.replace(/\s+/g, ' ').trim();
    // Bỏ các từ mô tả còn lại ở cuối chuỗi, kèm dấu phân cách đứng trước.
    // Thử cụm dài trước ("Official Audio") rồi mới tới cụm ngắn ("MV"), vì cụm
    // dài chứa cụm ngắn và bỏ sai thứ tự sẽ để lại rác.
    let changed = true;
    while (changed) {
        changed = false;
        const tokens = s.split(' ');
        for (let k = Math.min(3, tokens.length - 1); k >= 1; k--) {
            const tail = tokens.slice(-k).join(' ');
            if (!isJunk(tail))
                continue;
            s = tokens
                .slice(0, -k)
                .join(' ')
                .replace(/\s*[-–—]\s*$/, '')
                .trim();
            changed = true;
            break;
        }
    }
    // `Nghệ sĩ - Tên bài`. Chỉ tách khi phần đầu đủ ngắn để là một cái tên.
    const dash = s.match(/^(.{1,})\s+[-–—]\s+(.+)$/);
    if (dash) {
        const left = dash[1].trim();
        const right = dash[2].trim();
        if (left && right && left.length <= MAX_ARTIST_LEN) {
            return { title: right, artist: left };
        }
    }
    return { title: s };
}
//# sourceMappingURL=clean-title.js.map