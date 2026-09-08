import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyInput } from './index.ts'

test('nhận diện link YouTube các dạng', () => {
  for (const u of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
  ])
    assert.equal(classifyInput(u), 'youtube', u)
})

test('đường dẫn file là local', () => {
  assert.equal(classifyInput('/Users/me/song.mp3'), 'local')
  assert.equal(classifyInput('./song.flac'), 'local')
  assert.equal(classifyInput('~/Music/a.m4a'), 'local')
  assert.equal(classifyInput('song.mp3'), 'local')
})

test('link không phải YouTube cũng coi là local, để lỗi "file not found" nói rõ hơn', () => {
  assert.equal(classifyInput('https://open.spotify.com/track/abc'), 'local')
})
