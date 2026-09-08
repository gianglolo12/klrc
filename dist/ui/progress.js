const FILLED = '▰';
const EMPTY = '▱';
export function progressBar(ratio, width) {
    if (width <= 0)
        return '';
    const r = Math.min(Math.max(Number.isFinite(ratio) ? ratio : 0, 0), 1);
    const filled = Math.round(r * width);
    return FILLED.repeat(filled) + EMPTY.repeat(width - filled);
}
/** `0:05`, `3:47`, `12:03`. Giá trị âm coi như 0. */
export function formatTime(ms) {
    const total = Math.max(Math.floor((Number.isFinite(ms) ? ms : 0) / 1000), 0);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
/** `+0.25s`, `-0.50s`, `+0.0s` — dùng cho chỉ báo canh lệch. */
export function formatOffset(ms) {
    const sign = ms < 0 ? '-' : '+';
    const abs = Math.abs(ms) / 1000;
    return `${sign}${abs.toFixed(2)}s`;
}
//# sourceMappingURL=progress.js.map