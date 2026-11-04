import { test } from 'node:test'
import assert from 'node:assert/strict'
import { surveyRows, surveyCsv, surveyFileName, groupOf, SURVEY_HEAD } from '../src/lib/survey.js'

const rows = [
  { id: 1, change: 5, threshold: 22.9, verdict: 'hold' },
  { id: 2, change: -30.2, threshold: 22.9, verdict: 'retreat' },
  { id: 3, change: 41, threshold: 22.9, verdict: 'struct' },
  { id: 4, change: null, threshold: 22.9, verdict: 'nodata' },
  { id: 5, change: 25.4, threshold: 22.9, verdict: 'advance' },
  { id: 6, change: -12, threshold: 22.9, verdict: 'few' },
  { id: 7, change: 8, threshold: 22.9, verdict: 'struct' }
]
const site = { id: 'banam', name: '고성 반암' }

test('묶음 구분: 구조물 의심, 기준 초과, 판정 보류', () => {
  assert.equal(groupOf('struct'), 'struct')
  assert.equal(groupOf('advance'), 'exceed')
  assert.equal(groupOf('retreat'), 'exceed')
  for (const v of ['hold', 'nodata', 'few']) assert.equal(groupOf(v), 'hold')
})
test('우선순위는 구조물 의심, 기준 초과, 판정 보류 순이고 묶음 안은 이동 거리가 큰 순', () => {
  const r = surveyRows(rows)
  assert.deepEqual(r.map((x) => x.id), [3, 7, 2, 5, 6, 1, 4])
  assert.deepEqual(r.map((x) => x.priority), [1, 2, 3, 4, 5, 6, 7])
})
test('원래 배열을 바꾸지 않는다', () => {
  const copy = JSON.stringify(rows)
  surveyRows(rows)
  assert.equal(JSON.stringify(rows), copy)
})
test('CSV는 UTF-8 BOM으로 시작하고 CRLF 줄 끝, 머리와 가로선 수만큼 줄', () => {
  const t = surveyCsv({ site, rows, basisLabel: '1표준편차' })
  assert.equal(t.charCodeAt(0), 0xfeff)
  const lines = t.slice(1).split('\r\n').filter(Boolean)
  assert.equal(lines.length, rows.length + 1)
  assert.equal(lines[0], SURVEY_HEAD.join(','))
  assert.equal(lines[1], '1,고성 반암,3,구조물 의심 가로선,,41.0,22.9,1표준편차,물가선이 구조물이나 암초 위에서 잡힘')
  assert.equal(lines[3], '3,고성 반암,2,기준 초과,후퇴,-30.2,22.9,1표준편차,육지 쪽 이동')
  assert.equal(lines[7], '7,고성 반암,4,판정 보류,,,22.9,1표준편차,구름으로 해안선 미검출')
})
test('쉼표와 따옴표가 든 값은 따옴표로 감싼다', () => {
  const t = surveyCsv({ site: { id: 'x', name: '가, "나"' }, rows: [rows[0]], basisLabel: '95%' })
  assert.match(t, /,"가, ""나""",/)
})
test('빈 목록은 머리 줄만', () => {
  const t = surveyCsv({ site, rows: [], basisLabel: '95%' })
  assert.equal(t, '\uFEFF' + SURVEY_HEAD.join(',') + '\r\n')
})
test('파일 이름', () => { assert.equal(surveyFileName(site, '2026-11-04'), 'banam_현장측량구간_2026-11-04.csv') })
