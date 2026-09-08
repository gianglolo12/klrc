import { spawn } from 'node:child_process';
/**
 * Phát bằng `afplay` — có sẵn trong mọi bản macOS, nên không cần cài gì.
 *
 * Đổi lại, afplay không cho hỏi vị trí phát, nên vị trí ở đây là *phỏng đoán*:
 * đếm đồng hồ từ lúc bấm play và tin rằng nó phát đúng realtime. Thực tế lệch
 * dần 0.1-0.5s ở phút thứ 3-4. Muốn đồng bộ thật thì dùng MpvPlayer.
 */
export class AfplayPlayer {
    canSeek = false;
    label = 'afplay';
    audioPath;
    proc = null;
    startedAt = 0;
    pausedAt = null;
    pausedTotal = 0;
    stopped = false;
    endCallbacks = [];
    // Node chạy TypeScript ở chế độ strip-only: parameter property
    // (`constructor(private x)`) không được hỗ trợ, phải gán tường minh.
    constructor(audioPath) {
        this.audioPath = audioPath;
    }
    async play() {
        this.proc = spawn('afplay', [this.audioPath], { stdio: 'ignore' });
        this.startedAt = Date.now();
        this.proc.on('exit', () => {
            if (this.stopped)
                return;
            for (const cb of this.endCallbacks)
                cb();
        });
        // Không có afplay thì báo như hết bài, để CLI thoát gọn thay vì treo.
        this.proc.on('error', () => {
            if (!this.stopped)
                for (const cb of this.endCallbacks)
                    cb();
        });
    }
    get positionMs() {
        if (this.startedAt === 0)
            return 0;
        const now = this.pausedAt ?? Date.now();
        return Math.max(now - this.startedAt - this.pausedTotal, 0);
    }
    get isPaused() {
        return this.pausedAt !== null;
    }
    /** SIGSTOP/SIGCONT: afplay không có lệnh pause, nên đóng băng cả tiến trình. */
    pause() {
        if (this.pausedAt !== null || !this.proc)
            return;
        this.proc.kill('SIGSTOP');
        this.pausedAt = Date.now();
    }
    resume() {
        if (this.pausedAt === null || !this.proc)
            return;
        this.proc.kill('SIGCONT');
        this.pausedTotal += Date.now() - this.pausedAt;
        this.pausedAt = null;
    }
    seek(_ms) {
        // afplay không tua được. Im lặng bỏ qua — giao diện đã ẩn phím tua.
    }
    stop() {
        this.stopped = true;
        if (!this.proc)
            return;
        // Đang SIGSTOP thì phải SIGCONT trước, không thì process nằm lại như zombie.
        if (this.pausedAt !== null)
            this.proc.kill('SIGCONT');
        this.proc.kill('SIGTERM');
        this.proc = null;
    }
    onEnd(cb) {
        this.endCallbacks.push(cb);
    }
}
//# sourceMappingURL=afplay-player.js.map