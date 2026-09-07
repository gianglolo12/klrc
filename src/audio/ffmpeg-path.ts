import ffmpegStatic from 'ffmpeg-static'

/**
 * Đường dẫn tới binary ffmpeg do npm tải về.
 *
 * Bọc qua một chỗ vì `ffmpeg-static` khai báo type bằng `export default` nhưng
 * đóng gói là CommonJS, nên dưới moduleResolution NodeNext, TypeScript suy ra
 * cả module namespace thay vì một chuỗi. Ép kiểu ở đây một lần, thay vì rải
 * `as unknown as string` khắp nơi.
 */
export const ffmpegPath = ffmpegStatic as unknown as string | null
