import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanTitle } from './clean-title.ts'

test('bỏ ngoặc vuông và hậu tố quảng cáo', () => {
  assert.deepEqual(cleanTitle('Hạ Còn Vương Nắng | Official MV [4K]'), {
    title: 'Hạ Còn Vương Nắng',
  })
})

test('tách "Nghệ sĩ - Tên bài"', () => {
  assert.deepEqual(cleanTitle('Ed Sheeran - Shape of You (Official Video)'), {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
  })
})

test('bỏ các hậu tố Lyrics / Audio / Official / MV', () => {
  assert.equal(cleanTitle('Some Song (Lyrics)').title, 'Some Song')
  assert.equal(cleanTitle('Some Song - Official Audio').title, 'Some Song')
  assert.equal(cleanTitle('Some Song MV').title, 'Some Song')
})

test('không phá tiêu đề sạch', () => {
  assert.deepEqual(cleanTitle('Nơi Này Có Anh'), { title: 'Nơi Này Có Anh' })
})

test('tách được khi phần trước dấu gạch ngắn', () => {
  assert.equal(cleanTitle('Hai Phut Hon - KAIZ Remix').artist, 'Hai Phut Hon')
})

test('không tách khi phần trước dấu gạch quá dài', () => {
  const long = 'Mot Cai Ten Rat Dai Khong The Nao La Nghe Si Duoc Dau Ban A - B'
  assert.equal(cleanTitle(long).artist, undefined)
})

test('co nhiều khoảng trắng thành một', () => {
  assert.equal(cleanTitle('Song    Name').title, 'Song Name')
})

test('chuỗi rỗng không làm nổ', () => {
  assert.equal(cleanTitle('').title, '')
})
