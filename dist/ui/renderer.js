import { renderFrame } from "./frame.js";
import { CLEAR_BELOW, CLEAR_LINE, HIDE_CURSOR, HOME, SHOW_CURSOR } from "./theme.js";
/** 30fps: đủ mượt để chữ tô liền mạch, đủ rẻ để không hâm nóng CPU. */
const FRAME_INTERVAL_MS = 33;
export class Renderer {
    state;
    player;
    out;
    timer = null;
    lastFrame = null;
    running = false;
    constructor(state, player, out) {
        this.state = state;
        this.player = player;
        this.out = out;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.out.write(HIDE_CURSOR);
        this.draw();
        this.timer = setInterval(() => this.draw(), FRAME_INTERVAL_MS);
    }
    stop() {
        if (!this.running)
            return;
        this.running = false;
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
        this.out.write(`${SHOW_CURSOR}\n`);
    }
    /** Cho phép CLI đổi offset khi người dùng bấm `[` `]` mà không dựng lại renderer. */
    setOffset(ms) {
        this.state.offsetMs = ms;
    }
    draw() {
        if (!this.running)
            return;
        const width = this.out.columns ?? 80;
        const height = this.out.rows ?? 24;
        this.state.paused = this.player.isPaused;
        const positionMs = this.player.positionMs + this.state.offsetMs;
        const frame = renderFrame(this.state, positionMs, width, height);
        // Đoạn nhạc dạo và lúc tạm dừng cho ra khung y hệt nhau; bỏ qua việc ghi
        // giúp terminal khỏi nhấp nháy và tiết kiệm phần lớn I/O của cả bài.
        if (frame === this.lastFrame)
            return;
        this.lastFrame = frame;
        // Xoá phần dư từng dòng thay vì xoá cả màn hình: xoá cả màn gây nháy.
        const painted = frame
            .split('\n')
            .map((line) => line + CLEAR_LINE)
            .join('\n');
        this.out.write(HOME + painted + CLEAR_BELOW);
    }
}
//# sourceMappingURL=renderer.js.map