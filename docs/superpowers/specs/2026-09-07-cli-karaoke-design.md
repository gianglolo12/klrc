# klrc — Karaoke lời bài hát trong terminal

**Ngày:** 2026-09-07
**Trạng thái:** Đã duyệt thiết kế, chờ lập kế hoạch triển khai

## 1. Mục tiêu

Một CLI cho macOS: đưa vào link YouTube hoặc file nhạc local, nó phát bản gốc
và chạy lời bài hát tô sáng từng chữ theo nhạc — như Apple Music Sing nhưng
trong terminal.

Kèm một slash command `/karaoke` cho Claude Code, để người dùng gọi bằng *tên
bài hát* thay vì phải tự đi tìm link, và để Claude sửa được lời sai.

**Phát hành công khai** qua npm + Claude Code plugin marketplace. Tiêu chí
thiết kế xuyên suốt: người lạ cài xong là chạy được, không phải cài thêm gì.

### Không thuộc phạm vi v1

Tách beat để hát (Demucs), playlist, karaoke nhiều người, tính điểm, Spotify,
lời song ngữ. Whisper chỉ là tính năng tùy chọn, không bật mặc định.

## 2. Quyết định kiến trúc

| Quyết định | Chọn | Lý do |
|---|---|---|
| Ngôn ngữ | Node.js + TypeScript | `npx klrc` chạy không cần cài; Python buộc người dùng lo venv/phiên bản — chỗ đa số bỏ giữa đường |
| Giao diện | ANSI escape thuần, không framework | animation 30fps tô từng chữ; Ink/Textual render theo widget-tree sẽ giật |
| Phát nhạc | `mpv` qua IPC nếu có, `afplay` nếu không | mpv trả vị trí phát *thật* → đồng bộ chính xác + pause/tua; afplay có sẵn trong macOS nên fallback không cần cài |
| Nguồn lời | LRCLIB API | mở, miễn phí, không cần API key, phủ tốt nhạc phổ biến |
| Whisper | tùy chọn, không mặc định | bắt tải model 1GB để nghe một bài là quá đắt cho bản phát hành công khai |
| ffmpeg | npm `ffmpeg-static` | npm tự tải binary đúng OS lúc install → người dùng không cài gì |
| yt-dlp | tự tải binary standalone `yt-dlp_macos`, kiểm SHA-256 | `youtube-dl-exec` chỉ tải bản zip Python cần Python >= 3.10, mà macOS xuất xưởng với 3.9 → hỏng ngay lần chạy đầu. Bản standalone không cần Python. |
| OS | chỉ macOS | test được toàn bộ trên máy dev; Linux/Windows để sau |
| Spectrum | tính trước toàn bài, tra theo đồng hồ | không cần DSP realtime, CPU gần bằng 0, khớp nhạc tuyệt đối |

### Phụ thuộc hệ thống

Bắt buộc: không có. Tùy chọn: `mpv` (`brew install mpv`) để có đồng bộ chính
xác và tua được; `whisper.cpp` để tự sinh lời cho bài LRCLIB không có.

`klrc doctor` in ra máy đang thiếu gì và được lợi gì nếu thêm.

## 3. Module

Mỗi module một việc, giao tiếp qua kiểu dữ liệu rõ ràng, test được độc lập.

```
src/
  cli.ts              parse args, điều phối, bàn phím

  resolver/           input bất kỳ  ->  Track
    index.ts            chọn youtube hay local theo dạng input
    youtube.ts          yt-dlp tải audio + metadata
    local.ts            đọc ID3 tag từ mp3/flac

  lyrics/             Track  ->  Lyrics
    lrclib.ts           gọi API lrclib.net
    parser.ts           đọc định dạng .lrc (kể cả enhanced LRC timing từng chữ)
    interpolate.ts      timing dòng  ->  timing chữ
    store.ts            đọc/ghi ~/.klrc/lyrics/<hash>.lrc

  audio/
    analyze.ts          ffmpeg decode -> FFT -> Spectrum, cache JSON
    player.ts           interface Player
    mpv-player.ts       impl qua IPC socket
    afplay-player.ts    impl qua đếm đồng hồ

  ui/
    renderer.ts         vòng lặp 30fps
    frame.ts            (Lyrics, Spectrum, positionMs, width) -> string
    lyrics-view.ts      tô chữ, 4 cấp độ sáng
    spectrum.ts
    progress.ts
    countdown.ts
    theme.ts            gradient màu

  plugin/
    .claude-plugin/plugin.json
    commands/karaoke.md
```

### Kiểu dữ liệu chính

```ts
type Track = {
  audioPath: string
  title: string
  artist: string
  durationMs: number
  sourceId: string      // dùng làm khóa cache
}

type Word = { startMs: number; endMs: number; text: string }

type Line = {
  startMs: number
  endMs: number
  text: string
  words: Word[]         // rỗng nếu không suy ra được
}

type Lyrics = {
  lines: Line[]
  hasTiming: boolean    // false = lời tĩnh, không karaoke được
  offsetMs: number      // người dùng canh lệch; nguồn sự thật là config.json,
                        // KHÔNG ghi vào .lrc để Claude sửa lời không đụng offset
}

type Spectrum = {
  frameMs: number       // 50
  bands: number         // 16
  frames: Uint8Array[]  // mỗi frame 16 giá trị 0-255
}

interface Player {
  play(): Promise<void>
  pause(): void
  seek(ms: number): void
  readonly positionMs: number
  readonly canSeek: boolean
  stop(): void
}
```

## 4. Luồng dữ liệu

```
input ─> resolver ─> Track (audioPath + metadata)
                        │
            ┌───────────┴───────────┐   chạy song song
       lyrics.fetch()          audio.analyze()
       (mạng ~300ms)           (CPU ~1-2s)
            └───────────┬───────────┘
                        v
                  player.play()
                        v
         render loop 30fps ──đọc──> player.positionMs
```

Hai việc chờ chạy song song: tra lời chờ mạng, phân tích spectrum chờ CPU.
Thời gian khởi động bằng cái chậm hơn, không phải tổng hai cái.

### Ba điểm thiết kế then chốt

**`Player` là interface.** mpv và afplay thay nhau được mà `ui/` không biết gì.
`MpvPlayer.positionMs` hỏi socket ra số thật; `AfplayPlayer.positionMs` trả
`Date.now() - startedAt`. Khác biệt độ chính xác nằm gọn trong một file.

**Spectrum tính trước, không tính lúc phát.** `analyze.ts` decode thành PCM mono
8kHz, FFT cửa sổ 50ms, ra 16 dải tần mỗi frame. Bài 4 phút ≈ 4800 frame × 16
byte ≈ 300KB, cache lại. Lúc phát chỉ tra mảng theo `positionMs`.

**`~/.klrc/lyrics/` là mặt tiếp xúc giữa Claude và CLI.** CLI đọc, Claude ghi.
Không cần API, không cần IPC — chỉ là file. Đây là lý do `/karaoke fix` làm
được mà không phải sửa CLI.

### Cách tra LRCLIB

Tra hai bước, vì tỉ lệ tìm thấy bài phụ thuộc hoàn toàn vào khâu này:

1. `GET /api/get` với `track_name` + `artist_name` + `duration` — khớp chính xác,
   `duration` giúp loại bản remix/live sai độ dài.
2. Không thấy thì `GET /api/search` với từ khóa rồi chọn kết quả có độ dài lệch
   dưới 3 giây so với `Track.durationMs`.

Metadata YouTube thường bẩn (`"Tên bài | Official MV [4K]"`, tên kênh thay vì
tên nghệ sĩ), nên `resolver/youtube.ts` phải làm sạch trước khi tra: bỏ phần
trong `[]` `()`, bỏ các hậu tố `Official MV`, `Lyrics`, `Audio`, `4K`, và tách
`Nghệ sĩ - Tên bài` nếu tiêu đề có dấu gạch. Đây là nguồn lỗi "không tìm thấy
bài" phổ biến nhất, và cũng là chỗ `/karaoke` của Claude cứu được vì Claude
đoán đúng tên bài lẫn nghệ sĩ từ tiêu đề bẩn.

### Cấu trúc cache

```
~/.klrc/
  bin/yt-dlp                    binary standalone tự tải, đã kiểm SHA-256
  audio/<sourceId>.m4a          audio tải từ YouTube
  lyrics/<sourceId>.lrc         lời (Claude sửa được ở đây)
  spectrum/<sourceId>.json      spectrum đã tính
  config.json                   { offsets: { <sourceId>: ms }, theme }
```

## 5. Giao diện

Mockup 80 cột:

```
  Hạ Còn Vương Nắng · DatKaa                          mpv ●   offset +0.0s
 ─────────────────────────────────────────────────────────────────────────

         và rồi ngày ấy cũng qua đi thật nhanh
       anh vẫn nhớ như in ngày đầu tiên gặp em

    ▸  hạ còn vương nắng, anh còn vương em
       ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔

       mà sao giờ đây đôi ta đã cách xa nhau
         một mùa hạ nữa lại về trên phố

 ─────────────────────────────────────────────────────────────────────────
   ▁▂▃▅▇▆▄▂▁▃▅▇█▆▄▂▁▂▄▆█▇▅▃▁▂▃▅▄▂▁▂▄▅▇▆▃▁▂▄▆▇▅▃▂▁▃▄▂
   ▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱   1:24 / 3:47

   space tạm dừng    ←→ tua 5s    [ ] canh lệch    q thoát
                     ^^^^^^^^^^ ẩn khi chạy afplay (không tua được)
```

Dòng đang hát nằm ở **một phần ba trên** màn hình, không phải chính giữa: mắt
đọc xuôi xuống nên chỗ cho câu *sắp* hát quan trọng hơn câu đã qua.

Bốn cấp độ sáng: chữ đã hát sáng rực → chữ chưa hát trong câu hiện tại trắng
nhạt → câu liền kề xám → câu xa hơn xám mờ.

### Hiệu ứng

1. **Tô chữ trái → phải** trong câu đang hát, kèm gạch chân chạy theo phần đã
   hát. Gạch chân giúp bắt nhịp nhanh hơn màu, nhất là khi màu terminal mỗi
   người mỗi khác.
2. **Spectrum 16 dải**, tra từ mảng đã tính.
3. **Progress bar + thời gian.**
4. **Đếm ngược khi nghỉ dài.** Quãng cách giữa hai câu > 3s thì hiện `● ● ●`
   mờ dần theo nhịp thật của bài, để người xem không tưởng app treo.
5. **Gradient màu** dịch tông dần theo trục thời gian bài hát. Không chớp nháy.
6. **`[` `]` canh lệch ±0.25s, lưu vào cache.** Không hào nhoáng nhưng hữu dụng
   nhất: dữ liệu LRCLIB nhạc Việt lệch nửa giây là chuyện thường; canh ba giây
   rồi lần sau mở lại nó nhớ. Không có nó thì bài lệch coi như bỏ.

### Bàn phím

| Phím | Việc | Ghi chú |
|---|---|---|
| `space` | tạm dừng / tiếp tục | |
| `←` `→` | tua ∓5s | chỉ khi có mpv |
| `[` `]` | canh lệch ∓0.25s | lưu vào cache |
| `q` `Ctrl+C` | thoát | trả terminal về nguyên trạng |

## 6. Tích hợp Claude Code

### Điều không làm được

Slash command chỉ là file prompt; nó không chiếm được terminal, chỉ nhờ Claude
chạy Bash. Khi Claude chạy Bash, `stdout` bị capture chứ không phải TTY, nên
animation ANSI sẽ vỡ thành hàng nghìn dòng escape code, và Bash tool có timeout
nên bài 4 phút bị cắt giữa. **Chạy karaoke bên trong khung chat là bất khả thi.**

MCP server chịu đúng giới hạn này, nên không cần MCP.

### Kiến trúc tích hợp

```
/karaoke Hạ Còn Vương Nắng
   -> Claude search web, tìm link YouTube đúng bài
   -> osascript mở tab Terminal mới, chạy `klrc <link>`
   -> tab đó có TTY riêng -> animation mượt 30fps
   -> Claude Code rảnh ngay, người dùng tiếp tục làm việc
```

Cửa sổ karaoke sống độc lập; đóng nó không ảnh hưởng session Claude Code.
Nhận diện Terminal.app hay iTerm qua `$TERM_PROGRAM`.

### Bốn việc tích hợp đem lại (CLI thuần không làm được)

Nếu chỉ để gõ `/karaoke` thay cho `klrc` thì tích hợp này vô nghĩa. Nó đáng làm vì:

1. **Tìm bài bằng tên.** `/karaoke bài của Vũ về Hà Nội mùa thu` — Claude tra ra
   link. CLI thuần buộc người dùng rời terminal đi copy link.
2. **Sửa lời sai.** `/karaoke fix` — Claude mở `~/.klrc/lyrics/<id>.lrc` sửa
   trực tiếp. LRCLIB là dữ liệu cộng đồng, nhạc Việt hay thiếu dấu hoặc lệch câu.
3. **Làm sạch output Whisper.** Whisper trả lời thô: không dấu câu, sai từ đồng
   âm, lẫn tiếng Anh. Claude chỉnh trước khi nó thành `.lrc`. Đây là chỗ tích
   hợp tạo chênh lệch chất lượng lớn nhất.
4. **Lời song ngữ** (sau v1). Bài Nhật/Hàn: thêm dòng dịch, CLI hiện hai tầng.

### Chế độ không-TTY

CLI kiểm tra `process.stdout.isTTY`. Nếu không có TTY (đang bị gọi từ Bash
tool), **không** chạy animation mà in lời tĩnh kèm timestamp rồi thoát. Nhờ vậy
Claude gọi trực tiếp để *đọc* lời mà không ngập rác escape code.

## 7. Xử lý lỗi

Nguyên tắc: **hiệu ứng chết thì bỏ hiệu ứng, đừng bỏ bài hát.**

| Chuyện xảy ra | App làm gì |
|---|---|
| ffmpeg phân tích lỗi | chạy tiếp, không spectrum, không báo ồn ào |
| mpv không có | dùng afplay, ghi `afplay ●` ở góc để người dùng biết vì sao không tua được |
| Terminal < 60 cột | bỏ spectrum rồi bỏ progress bar, giữ lời tới cùng |
| Không phải TTY | in lời tĩnh kèm timestamp rồi thoát |
| LRCLIB có lời nhưng không timing | hiện lời tĩnh cuộn tay, nói rõ "bài này chưa có timing" |
| **LRCLIB không có bài** | lỗi thật — dừng, gợi ý `/karaoke fix` |
| Video private / chặn vùng | thông báo đúng nguyên nhân, không phun stack trace |
| Mất mạng giữa lúc tải | thông báo rõ, giữ lại phần đã tải để chạy lại nhanh |
| `Ctrl+C` | hiện lại con trỏ, tắt player, trả terminal nguyên trạng |

Hai dòng "LRCLIB không có bài" và "video bị chặn" là hai lỗi người dùng thật sẽ
gặp nhiều nhất — cần thông báo rõ ràng nhất.

## 8. Chiến lược test

Chỗ khó: test một thứ vốn là animation và âm thanh.

Cách giải là **`Player` fake**. Vì `ui/` chỉ biết `player.positionMs`, đưa vào
player giả trả đúng 45000ms rồi so khung ANSI sinh ra với snapshot đã lưu.
Animation trở thành hàm thuần `(lyrics, spectrum, positionMs, width) -> string`:
test được, chạy trong milliseconds, không cần loa.

| Đối tượng | Cách test |
|---|---|
| `parser.ts` | nhiều mẫu `.lrc` thật: enhanced LRC, thiếu timing, file hỏng, dòng rỗng |
| `interpolate.ts` | ca khó: câu một từ, câu rỗng, câu dài hơn khoảng thời gian |
| `frame.ts` | snapshot ở nhiều mốc thời gian × nhiều chiều rộng (40/60/80/120 cột) |
| `resolver` / `lrclib` | mock mạng |
| `store.ts` | đọc/ghi cache, offset lưu lại đúng |
| đầu-cuối | một mp3 5 giây + `.lrc` thật trong fixtures |

**Không test được bằng máy:** lời có khớp nhạc thật hay không, spectrum có đẹp
hay không. Hai thứ đó cần người nghe thử một bài và nói lệch chỗ nào.

Áp dụng TDD khi triển khai: viết test trước cho từng module.

## 9. Thứ tự xây dựng

1. `parser.ts` + `interpolate.ts` — thuần logic, không phụ thuộc gì, test dày
2. `lrclib.ts` + `store.ts` — lấy được lời thật về đĩa
3. `resolver/local.ts` — chạy được với file local trước, đơn giản hơn YouTube
4. `audio/player.ts` + `afplay-player.ts` — phát được nhạc
5. `ui/frame.ts` + `renderer.ts` — karaoke chạy được, chưa có hiệu ứng phụ
6. `resolver/youtube.ts` — thêm nguồn YouTube
7. `audio/analyze.ts` + `ui/spectrum.ts` — thêm spectrum
8. `mpv-player.ts` — nâng cấp đồng bộ, mở đường cho tua
9. countdown, gradient, canh lệch
10. `plugin/` — slash command + osascript
11. `klrc doctor`, README, phát hành npm

Mốc dùng được sớm nhất là bước 5: file local + lời + tô chữ.
