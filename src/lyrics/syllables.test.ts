import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countSyllables } from './syllables.ts'

test('mỗi tiếng Việt là đúng một âm tiết, kể cả khi có dấu', () => {
  // Cấu trúc âm tiết tiếng Việt luôn cho đúng một nhóm nguyên âm mỗi tiếng.
  for (const word of [
    'anh',
    'nắng',
    'đường',
    'nguyễn',
    'khuyên',
    'thuyền',
    'ước',
    'giường',
    'quả',
    'hoa',
    'tuyệt',
    'mưa',
  ]) {
    assert.equal(countSyllables(word), 1, `"${word}" phải là 1 âm tiết`)
  }
})

test('tiếng Anh: từ nhiều âm tiết được đếm nhiều hơn', () => {
  assert.equal(countSyllables('a'), 1)
  assert.equal(countSyllables('day'), 1)
  assert.ok(countSyllables('wonderful') >= 3, 'wonderful phải từ 3 âm tiết trở lên')
  assert.ok(countSyllables('unbelievable') >= 4)
  assert.ok(
    countSyllables('unbelievable') > countSyllables('wonderful'),
    'từ dài hơn phải nhiều âm tiết hơn',
  )
})

test('từ một âm tiết tiếng Anh không bị đếm thành hai vì chữ e cuối', () => {
  for (const word of ['make', 'time', 'love', 'these', 'gone']) {
    assert.equal(countSyllables(word), 1, `"${word}" phải là 1 âm tiết`)
  }
})

test('luôn tối thiểu 1, kể cả từ không có nguyên âm', () => {
  assert.equal(countSyllables('hmm'), 1)
  assert.equal(countSyllables('shh'), 1)
  assert.equal(countSyllables('!'), 1)
})

test('chuỗi rỗng trả 1 chứ không phải 0, để không chia cho 0', () => {
  assert.equal(countSyllables(''), 1)
})

test('bỏ dấu câu bám quanh từ', () => {
  assert.equal(countSyllables('nắng,'), 1)
  assert.equal(countSyllables('(anh)'), 1)
  assert.equal(countSyllables('em!'), 1)
})

test('chữ hoa cho cùng kết quả với chữ thường', () => {
  assert.equal(countSyllables('Nắng'), countSyllables('nắng'))
  assert.equal(countSyllables('WONDERFUL'), countSyllables('wonderful'))
})
