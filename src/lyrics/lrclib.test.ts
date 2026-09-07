import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchLyrics } from './lrclib.ts'

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
const notFound = () => new Response('{}', { status: 404 })

test('dùng /api/get khi khớp chính xác', async () => {
  const urls: string[] = []
  const fake = async (u: string | URL) => {
    urls.push(String(u))
    return ok({ syncedLyrics: '[00:01.00] hi', plainLyrics: 'hi', instrumental: false })
  }
  const r = await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 234000 }, fake as typeof fetch)
  assert.equal(r.kind, 'synced')
  assert.ok(urls[0].includes('/api/get'))
  assert.ok(urls[0].includes('duration=234'), 'duration gửi bằng giây')
})

test('/api/get trượt thì chuyển sang /api/search và lọc theo độ dài', async () => {
  const fake = async (u: string | URL) => {
    const s = String(u)
    if (s.includes('/api/get')) return notFound()
    return ok([
      { trackName: 'X', artistName: 'Y', duration: 157, syncedLyrics: '[00:01.00] sai do dai' },
      { trackName: 'X', artistName: 'Y', duration: 285.696, syncedLyrics: '[00:02.00] dung' },
    ])
  }
  const r = await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 286000 }, fake as typeof fetch)
  assert.equal(r.kind, 'synced')
  assert.ok(r.kind === 'synced' && r.lrc.includes('dung'), 'phải chọn bản lệch dưới 3 giây')
})

test('chọn bản lệch ít nhất khi có nhiều bản hợp lệ', async () => {
  const fake = async (u: string | URL) =>
    String(u).includes('/api/get')
      ? notFound()
      : ok([
          { duration: 288, syncedLyrics: '[00:01.00] lech 2 giay' },
          { duration: 286.2, syncedLyrics: '[00:01.00] lech 0.2 giay' },
        ])
  const r = await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 286000 }, fake as typeof fetch)
  assert.ok(r.kind === 'synced' && r.lrc.includes('0.2'))
})

test('không kết quả nào lệch dưới 3 giây -> none', async () => {
  const fake = async (u: string | URL) =>
    String(u).includes('/api/get')
      ? notFound()
      : ok([{ duration: 100, syncedLyrics: '[00:01.00] a' }])
  const r = await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 286000 }, fake as typeof fetch)
  assert.equal(r.kind, 'none')
})

test('chỉ có plainLyrics -> kind plain', async () => {
  const fake = async () =>
    ok({ syncedLyrics: null, plainLyrics: 'no timing here', instrumental: false })
  const r = await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 1000 }, fake as typeof fetch)
  assert.equal(r.kind, 'plain')
})

test('bài instrumental -> none', async () => {
  const fake = async () => ok({ syncedLyrics: null, plainLyrics: null, instrumental: true })
  const r = await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 1000 }, fake as typeof fetch)
  assert.equal(r.kind, 'none')
})

test('lỗi mạng không ném ra ngoài, trả none', async () => {
  const fake = async () => {
    throw new Error('ENOTFOUND')
  }
  const r = await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 1000 }, fake as typeof fetch)
  assert.equal(r.kind, 'none')
})

test('JSON hỏng cũng trả none', async () => {
  const fake = async () => new Response('không phải json', { status: 200 })
  const r = await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 1000 }, fake as typeof fetch)
  assert.equal(r.kind, 'none')
})

test('gửi User-Agent', async () => {
  let ua = ''
  const fake = async (_u: string | URL, init?: RequestInit) => {
    ua = String((init?.headers as Record<string, string>)?.['User-Agent'] ?? '')
    return ok({ syncedLyrics: '[00:01.00] hi', instrumental: false })
  }
  await fetchLyrics({ title: 'X', artist: 'Y', durationMs: 1000 }, fake as typeof fetch)
  assert.ok(ua.startsWith('klrc/'), 'LRCLIB yêu cầu User-Agent')
})
