import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolveLocal } from './local.ts'

const p = fileURLToPath(new URL('./fixtures/tone5s.mp3', import.meta.url))

test('đọc metadata và độ dài từ file mp3', async () => {
  const t = await resolveLocal(p)
  assert.equal(t.title, 'Test Song')
  assert.equal(t.artist, 'Test Artist')
  assert.ok(Math.abs(t.durationMs - 5000) < 500, `độ dài ${t.durationMs} phải quanh 5000`)
  assert.equal(t.audioPath, p)
  assert.ok(t.sourceId.startsWith('local-'))
})

test('cùng một file cho cùng sourceId', async () => {
  const a = await resolveLocal(p)
  const b = await resolveLocal(p)
  assert.equal(a.sourceId, b.sourceId)
})

test('file không có tag -> lấy tên file làm title, artist rỗng', async () => {
  const { ffmpegPath } = await import('../audio/ffmpeg-path.ts')
  const ffmpeg = ffmpegPath as string
  const bare = '/tmp/klrc-bare-song.mp3'
  execFileSync(ffmpeg, [
    '-y',
    '-v',
    'quiet',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=1',
    bare,
  ])
  const t = await resolveLocal(bare)
  assert.equal(t.title, 'klrc-bare-song')
  assert.equal(t.artist, '')
  rmSync(bare, { force: true })
})

test('file không tồn tại -> ném lỗi có thông báo rõ', async () => {
  await assert.rejects(() => resolveLocal('/khong/ton/tai.mp3'), /not found/i)
})
