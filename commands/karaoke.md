---
description: Chạy karaoke lời bài hát trong một cửa sổ terminal mới
---

Người dùng muốn nghe karaoke: `$ARGUMENTS`

Xác định họ đưa vào cái gì rồi làm theo đúng một nhánh dưới đây.

## Nếu là link YouTube hoặc đường dẫn file

Mở karaoke ngay:

```bash
npx klrc --open "<link hoặc đường dẫn>"
```

## Nếu là tên bài hát

1. Tìm trên web link YouTube của đúng bài đó. Ưu tiên bản audio hoặc MV chính
   thức. Tránh bản cover, live, sped up / nightcore, và bản "1 hour loop" —
   những bản này lệch độ dài nên tra lời sẽ trượt.
2. Nói cho người dùng biết bạn chọn bản nào (tên bài, nghệ sĩ), rồi mở:

```bash
npx klrc --open "<link tìm được>"
```

## Nếu là `fix` (lời sai hoặc lệch nhịp)

1. Lấy đường dẫn file lời của bài vừa nghe:

```bash
npx klrc path --last
```

2. Đọc file `.lrc` đó. Mỗi dòng có dạng `[mm:ss.xx] nội dung câu`.
3. Sửa theo đúng loại vấn đề:
   - **Sai chữ, sai chính tả, thiếu dấu** → sửa phần text, **giữ nguyên
     timestamp**.
   - **Thiếu câu** → thêm dòng mới với timestamp nội suy giữa hai câu liền kề.
   - **Lệch nhịp cả bài** → **đừng sửa file**. Nói người dùng bấm `[` hoặc `]`
     trong lúc chạy: độ lệch được lưu riêng ở `config.json` và không đụng tới
     lời, nên sửa file ở đây là sai chỗ và sẽ bị ghi đè khi lời được tải lại.
4. Ghi file lại, rồi bảo người dùng chạy `/karaoke` lại với cùng bài.

## Nếu klrc báo `no lyrics found`

1. Kiểm tra lại tên bài và nghệ sĩ. Metadata YouTube thường bẩn, nên thử tra lại
   với tên chuẩn:

```bash
npx klrc --open --title "<tên bài đúng>" --artist "<nghệ sĩ đúng>" "<link>"
```

2. Vẫn không có thì nói rõ: lrclib.net chưa có bài này, và người dùng có thể góp
   lời lên lrclib.net để lần sau ai cũng dùng được.

## Hai điều cần biết

- Karaoke chạy **cạnh cuộc trò chuyện**, không chạy trong đó: một pane tmux nếu
  người dùng đang ở trong tmux, không thì một cửa sổ Terminal mới. `klrc` tự nhận
  diện, bạn không phải làm gì.
- Không chạy được bên trong khung chat, và đó là giới hạn cứng: animation tô chữ
  cần TTY thật để ghi đè màn hình, còn output của Bash tool thì bị capture nên sẽ
  vỡ thành hàng nghìn dòng escape code rồi bị timeout cắt giữa bài. Nếu người dùng
  hỏi vì sao, nói thẳng như vậy và gợi ý chạy Claude Code trong tmux
  (`brew install tmux`) để pane karaoke nằm ngay dưới chat.
- Chỉ chạy `npx klrc` **không kèm** `--open` khi bạn cần *đọc* lời để sửa. Không
  có TTY, nó in lời tĩnh kèm timestamp rồi thoát — vừa đúng để đọc.
