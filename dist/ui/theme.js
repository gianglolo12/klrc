/**
 * Màu và mã điều khiển terminal.
 *
 * Mọi escape viết bằng `\x1b`, không bao giờ chèn ký tự ESC thật vào source —
 * ký tự thật làm hỏng diff, grep và heredoc.
 */
/** Tắt màu khi NO_COLOR được đặt, hoặc khi output không phải terminal. */
const colorOn = () => !process.env.NO_COLOR && process.stdout.isTTY !== false;
const sgr = (code) => (colorOn() ? `\x1b[${code}m` : '');
/** Bốn cấp độ sáng, theo khoảng cách tới câu đang hát. */
export const SUNG = () => sgr('1;97');
export const UNSUNG = () => sgr('37');
export const NEAR = () => sgr('90');
export const FAR = () => sgr('2;90');
export const ACCENT = () => sgr('36');
export const RESET = () => sgr('0');
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';
export const HOME = '\x1b[H';
export const CLEAR_LINE = '\x1b[K';
export const CLEAR_BELOW = '\x1b[J';
export const stripAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '');
/** Bề rộng hiển thị thật: bỏ mã màu trước khi đếm. */
export const visibleWidth = (s) => stripAnsi(s).length;
/**
 * Thang màu dùng cho câu đang hát: trầm ấm → trung tính → cao lạnh.
 * Đi qua các mốc 256-color thay vì đổi hue liên tục, để không chớp nháy.
 */
const TONE_STOPS = [215, 216, 222, 228, 194, 158, 123, 117, 111, 147];
const toneAt = (ratio) => {
    if (!colorOn())
        return '';
    const r = Math.min(Math.max(ratio, 0), 1);
    const idx = Math.min(Math.floor(r * TONE_STOPS.length), TONE_STOPS.length - 1);
    return `\x1b[1;38;5;${TONE_STOPS[idx]}m`;
};
/** Tông theo tiến độ bài hát. Dùng khi không đọc được cao độ. */
export function gradientAt(ratio) {
    return toneAt(ratio);
}
/**
 * Tông theo cao độ: dải tần trội quyết định màu chữ đang hát.
 *
 * Khác gradient theo tiến độ ở chỗ nó thật sự phản ứng với nhạc — đoạn hát cao
 * vút ra màu sáng lạnh, đoạn trầm ra màu ấm. `null` (phổ phẳng, không có dải
 * nào trội) thì rơi về tông theo tiến độ để màu không nhảy vô nghĩa.
 */
export function pitchColor(level, progress) {
    return toneAt(level ?? progress);
}
/**
 * Ký tự gạch chân dưới câu đang hát, dày lên theo tiếng trống.
 *
 * Chỉ đổi độ đậm chứ không đổi chiều cao hay vị trí: layout phải đứng yên để
 * mắt còn đọc được lời.
 */
export function beatUnderline(intensity) {
    return intensity > 0.66 ? '━' : intensity > 0.33 ? '▔' : '─';
}
/** Đường kẻ ngang sáng lên theo nhịp. */
export function beatRuleColor(intensity) {
    if (!colorOn())
        return '';
    return intensity > 0.6 ? sgr('37') : intensity > 0.3 ? sgr('90') : sgr('2;90');
}
//# sourceMappingURL=theme.js.map