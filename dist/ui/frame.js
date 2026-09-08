import { findActiveLine, splitSung } from "./lyrics-view.js";
import { formatOffset, formatTime, progressBar } from "./progress.js";
import { spectrumLine } from "./spectrum.js";
import { countdownLine } from "./countdown.js";
import { ACCENT, FAR, NEAR, RESET, SUNG, UNSUNG, gradientAt, stripAnsi } from "./theme.js";
/** Dưới ngưỡng này thì spectrum chen chúc thành một vệt, bỏ đi đẹp hơn. */
const MIN_WIDTH_SPECTRUM = 60;
const MIN_WIDTH_PROGRESS = 50;
const SIDE_PADDING = 3;
const clampVisible = (s, max) => {
    // Chỉ cắt được an toàn trên chuỗi chưa nhuộm màu; hàm này luôn nhận chuỗi thô.
    return s.length <= max ? s : s.slice(0, Math.max(max, 0));
};
const centered = (text, width) => {
    const w = stripAnsi(text).length;
    const pad = Math.max(Math.floor((width - w) / 2), 0);
    return ' '.repeat(pad) + text;
};
function headerLine(s, positionMs, width) {
    const rightParts = [`${s.playerLabel} ●`];
    if (s.offsetMs !== 0)
        rightParts.push(formatOffset(s.offsetMs));
    if (s.paused)
        rightParts.push('paused');
    const right = rightParts.join('   ');
    const left = s.artist ? `${s.title} · ${s.artist}` : s.title;
    const room = width - SIDE_PADDING - stripAnsi(right).length - 2;
    const leftCut = clampVisible(left, Math.max(room, 0));
    const gap = Math.max(width - SIDE_PADDING - leftCut.length - right.length, 1);
    return ` ${SUNG()}${leftCut}${RESET()}${' '.repeat(gap)}${FAR()}${right}${RESET()}`;
}
const ruleLine = (width) => ` ${FAR()}${'─'.repeat(Math.max(width - 2, 0))}${RESET()}`;
function keysLine(s, width) {
    const keys = ['space pause'];
    if (s.canSeek)
        keys.push('←→ seek 5s');
    keys.push('[ ] sync', 'q quit');
    const text = keys.join('    ');
    return ` ${FAR()}${clampVisible(text, Math.max(width - 3, 0))}${RESET()}`;
}
/**
 * Khối lời. Câu đang hát nằm ở một phần ba trên chứ không phải chính giữa: mắt
 * đọc xuôi xuống, nên chỗ cho câu *sắp* hát quan trọng hơn câu đã qua.
 */
function lyricsBlock(s, positionMs, width, height) {
    const out = [];
    const maxText = Math.max(width - SIDE_PADDING * 2, 8);
    const lines = s.lyrics.lines;
    if (lines.length === 0) {
        out.push(centered(`${FAR()}(no lyrics)${RESET()}`, width));
        while (out.length < height)
            out.push('');
        return out.slice(0, height);
    }
    if (!s.lyrics.hasTiming) {
        out.push(centered(`${ACCENT()}(no timing for this song — lyrics only)${RESET()}`, width));
        for (const line of lines.slice(0, Math.max(height - 1, 0))) {
            out.push(centered(`${NEAR()}${clampVisible(line.text, maxText)}${RESET()}`, width));
        }
        while (out.length < height)
            out.push('');
        return out.slice(0, height);
    }
    const active = findActiveLine(lines, positionMs);
    const above = Math.floor(height / 3);
    const start = active - above;
    const progress = s.durationMs > 0 ? positionMs / s.durationMs : 0;
    const activeColor = gradientAt(progress) || SUNG();
    // Nơi đặt dấu đếm ngược: dòng gạch chân khi đang có câu, hoặc chỗ câu đầu
    // tiên sẽ xuất hiện khi nhạc còn dạo đầu.
    let countdownRow = -1;
    for (let i = start; out.length < height; i++) {
        if (i < 0 || i >= lines.length) {
            // Nhạc còn dạo đầu (active = -1): chỗ đặt dấu đếm là dòng trống ngay trên
            // câu đầu tiên, tức đúng vị trí câu đang hát sẽ xuất hiện.
            if (i === active && countdownRow === -1)
                countdownRow = out.length;
            out.push('');
            continue;
        }
        const line = lines[i];
        const distance = Math.abs(i - active);
        if (i === active) {
            const { sung, unsung } = splitSung(line.words, positionMs);
            const full = clampVisible(sung + unsung, maxText);
            const sungLen = Math.min(sung.length, full.length);
            const head = full.slice(0, sungLen);
            const tail = full.slice(sungLen);
            const pad = Math.max(Math.floor((width - full.length) / 2), 0);
            out.push(`${' '.repeat(pad)}${activeColor}${head}${RESET()}${UNSUNG()}${tail}${RESET()}`);
            // Gạch chân chạy theo phần đã hát: bắt nhịp bằng hình nhanh hơn bằng màu,
            // và không phụ thuộc bảng màu của từng terminal.
            if (out.length < height) {
                countdownRow = out.length;
                out.push(`${' '.repeat(pad)}${activeColor}${'▔'.repeat(head.length)}${RESET()}`);
            }
            continue;
        }
        const color = distance === 1 ? NEAR() : FAR();
        out.push(centered(`${color}${clampVisible(line.text, maxText)}${RESET()}`, width));
    }
    // Quãng nghỉ dài: thay gạch chân bằng dấu đếm ngược. Lúc nghỉ, gạch chân đã
    // phủ hết câu vừa hát nên chẳng còn nói gì; dấu đếm thì cho người xem biết
    // còn bao lâu, thay vì ngồi trước màn hình đứng im và tưởng app treo.
    const countdown = countdownLine(lines, positionMs, width);
    if (countdown && countdownRow >= 0 && countdownRow < out.length) {
        out[countdownRow] = countdown;
    }
    return out.slice(0, height);
}
export function renderFrame(s, positionMs, width, height) {
    const w = Math.max(width, 20);
    const h = Math.max(height, 4);
    const showRules = h >= 8;
    const showKeys = h >= 10;
    const showProgress = w >= MIN_WIDTH_PROGRESS && h >= 7;
    const showSpectrum = s.spectrum !== null && w >= MIN_WIDTH_SPECTRUM && h >= 12;
    const top = 1 + (showRules ? 1 : 0);
    const bottom = (showRules ? 1 : 0) + (showSpectrum ? 1 : 0) + (showProgress ? 1 : 0) + (showKeys ? 1 : 0);
    const lyricsHeight = Math.max(h - top - bottom, 1);
    const parts = [headerLine(s, positionMs, w)];
    if (showRules)
        parts.push(ruleLine(w));
    parts.push(...lyricsBlock(s, positionMs, w, lyricsHeight));
    if (showRules)
        parts.push(ruleLine(w));
    if (showSpectrum && s.spectrum) {
        parts.push(` ${spectrumLine(s.spectrum, positionMs, Math.max(w - 3, 0))}`);
    }
    if (showProgress) {
        const time = `${formatTime(positionMs)} / ${formatTime(s.durationMs)}`;
        const barWidth = Math.max(w - time.length - SIDE_PADDING * 2 - 2, 4);
        const ratio = s.durationMs > 0 ? positionMs / s.durationMs : 0;
        parts.push(` ${ACCENT()}${progressBar(ratio, barWidth)}${RESET()} ${FAR()}${time}${RESET()}`);
    }
    if (showKeys)
        parts.push(keysLine(s, w));
    return parts.slice(0, h).join('\n');
}
//# sourceMappingURL=frame.js.map