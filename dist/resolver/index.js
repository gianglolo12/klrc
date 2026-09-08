import { resolveLocal } from "./local.js";
import { resolveYoutube } from "./youtube.js";
const YOUTUBE = /^https?:\/\/([\w-]+\.)*(youtube\.com|youtu\.be)\//i;
/**
 * Chỉ nhận diện YouTube; mọi thứ khác coi là đường dẫn file, kể cả link của
 * dịch vụ khác — lỗi "Audio file not found: <link>" nói rõ vấn đề hơn là một
 * lỗi tải nhạc mơ hồ.
 */
export const classifyInput = (input) => YOUTUBE.test(input.trim()) ? 'youtube' : 'local';
export const resolve = (input) => classifyInput(input) === 'youtube' ? resolveYoutube(input) : resolveLocal(input);
//# sourceMappingURL=index.js.map