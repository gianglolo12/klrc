import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
/**
 * Phát bằng mpv, điều khiển qua IPC socket.
 *
 * Khác biệt thật sự so với afplay: mpv trả về *vị trí phát thật*, nên lời không
 * lệch dần theo bài, và tua được. Đó là lý do duy nhất mpv đáng để cài thêm.
 */
/** Hỏi mpv 4 lần mỗi giây; giữa hai lần thì nội suy bằng đồng hồ. */
const SYNC_INTERVAL_MS = 250;
/** mpv cần chút thời gian mới tạo socket, nên phải thử lại. */
const CONNECT_RETRIES = 40;
const CONNECT_DELAY_MS = 50;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class MpvPlayer {
    canSeek = true;
    label = 'mpv';
    audioPath;
    socketPath;
    proc = null;
    socket = null;
    syncTimer = null;
    baseMs = 0;
    baseAt = 0;
    paused = false;
    stopped = false;
    requestId = 1;
    endCallbacks = [];
    constructor(audioPath) {
        this.audioPath = audioPath;
        this.socketPath = join(tmpdir(), `klrc-mpv-${process.pid}-${Date.now()}.sock`);
    }
    async play() {
        this.proc = spawn('mpv', [
            '--no-video',
            '--no-terminal',
            '--really-quiet',
            // Thoát hẳn khi hết bài thay vì nằm chờ: nếu mpv ở lại, tiến trình
            // Node cũng không thoát được vì handle con còn sống.
            '--idle=no',
            '--keep-open=no',
            `--input-ipc-server=${this.socketPath}`,
            this.audioPath,
        ], { stdio: 'ignore' });
        this.proc.on('exit', () => {
            // Hết bài mà không ai gọi stop(): phải tự dọn vòng đồng bộ, không thì nó
            // hỏi một socket đã chết 4 lần mỗi giây và tiến trình không bao giờ thoát.
            this.clearSync();
            if (this.stopped)
                return;
            for (const cb of this.endCallbacks)
                cb();
        });
        this.proc.on('error', () => {
            if (!this.stopped)
                for (const cb of this.endCallbacks)
                    cb();
        });
        this.baseAt = Date.now();
        this.socket = await this.connect();
        if (this.socket) {
            // Socket không được giữ event loop lại, không thì tiến trình treo sau khi
            // karaoke kết thúc.
            this.socket.unref();
            this.socket.on('data', (chunk) => this.onData(chunk));
            // Hỏi ngay một lần để không phải chờ hết nhịp đầu tiên.
            this.requestPosition();
            this.syncTimer = setInterval(() => this.requestPosition(), SYNC_INTERVAL_MS);
        }
    }
    async connect() {
        for (let attempt = 0; attempt < CONNECT_RETRIES; attempt++) {
            if (this.stopped)
                return null;
            const socket = await new Promise((resolve) => {
                const s = createConnection(this.socketPath);
                s.once('connect', () => resolve(s));
                s.once('error', () => {
                    s.destroy();
                    resolve(null);
                });
            });
            if (socket)
                return socket;
            await sleep(CONNECT_DELAY_MS);
        }
        // Không kết nối được thì vẫn phát được nhạc, chỉ mất độ chính xác.
        return null;
    }
    send(command) {
        if (!this.socket || this.socket.destroyed)
            return;
        try {
            this.socket.write(`${JSON.stringify({ command, request_id: this.requestId++ })}\n`);
        }
        catch {
            // mpv đã thoát; vòng lặp render vẫn chạy bằng vị trí nội suy.
        }
    }
    requestPosition() {
        this.send(['get_property', 'time-pos']);
    }
    clearSync() {
        if (this.syncTimer)
            clearInterval(this.syncTimer);
        this.syncTimer = null;
    }
    onData(chunk) {
        for (const line of chunk.toString().split('\n')) {
            if (!line.trim())
                continue;
            try {
                const msg = JSON.parse(line);
                if (msg.error === 'success' && typeof msg.data === 'number') {
                    // Hiệu chỉnh mốc: giữa hai lần hỏi, vị trí được nội suy từ đây.
                    this.baseMs = msg.data * 1000;
                    this.baseAt = Date.now();
                }
            }
            catch {
                // mpv cũng gửi event không phải phản hồi; bỏ qua.
            }
        }
    }
    /**
     * Không hỏi socket ở đây: vòng lặp render gọi 30 lần mỗi giây, hỏi đồng bộ sẽ
     * chặn. Nội suy từ mốc gần nhất cho vừa mượt vừa không lệch tích lũy.
     */
    get positionMs() {
        if (this.paused)
            return Math.max(this.baseMs, 0);
        return Math.max(this.baseMs + (Date.now() - this.baseAt), 0);
    }
    get isPaused() {
        return this.paused;
    }
    pause() {
        if (this.paused)
            return;
        // Chốt vị trí trước khi dừng, không thì lúc resume mốc bị tính sai.
        this.baseMs = this.positionMs;
        this.baseAt = Date.now();
        this.paused = true;
        this.send(['set_property', 'pause', true]);
    }
    resume() {
        if (!this.paused)
            return;
        this.paused = false;
        this.baseAt = Date.now();
        this.send(['set_property', 'pause', false]);
    }
    seek(ms) {
        const target = Math.max(ms, 0);
        this.baseMs = target;
        this.baseAt = Date.now();
        this.send(['seek', target / 1000, 'absolute']);
    }
    stop() {
        this.stopped = true;
        this.clearSync();
        // `end()` chứ không phải `write()` rồi `destroy()`: destroy ngay sau write
        // đóng socket trước khi lệnh quit kịp ra khỏi buffer, và mpv sống sót.
        if (this.socket && !this.socket.destroyed) {
            try {
                this.socket.end(`${JSON.stringify({ command: ['quit'], request_id: this.requestId++ })}\n`);
            }
            catch {
                this.socket.destroy();
            }
            this.socket = null;
        }
        const proc = this.proc;
        this.proc = null;
        if (proc) {
            proc.kill('SIGTERM');
            // Đường lùi: mpv treo thì vẫn còn phát tiếng sau khi người dùng đã thoát,
            // nên phải chắc chắn nó chết.
            const killer = setTimeout(() => {
                try {
                    proc.kill('SIGKILL');
                }
                catch {
                    // Đã thoát rồi.
                }
            }, 400);
            killer.unref();
            proc.once('exit', () => clearTimeout(killer));
            proc.unref();
        }
        try {
            unlinkSync(this.socketPath);
        }
        catch {
            // Socket đã bị mpv dọn, hoặc chưa từng được tạo.
        }
    }
    onEnd(cb) {
        this.endCallbacks.push(cb);
    }
}
//# sourceMappingURL=mpv-player.js.map