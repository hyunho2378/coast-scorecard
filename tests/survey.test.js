import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { surveyRows, surveyCsv, surveyFileName, groupOf, basePoint, SURVEY_HEAD } from '../src/lib/survey.js'
import { normalizeShorelines, normalizeTransects } from '../src/lib/loader-core.js'
import { judgeRows } from '../src/lib/judge.js'

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

test('묶음 구분: 구조물 의심, 변화 확인(기준 초과), 정규 측량 일정(판정 보류)', () => {
  assert.equal(groupOf('struct'), 'struct')
  assert.equal(groupOf('advance'), 'exceed')
  assert.equal(groupOf('retreat'), 'exceed')
  for (const v of ['hold', 'nodata', 'few']) assert.equal(groupOf(v), 'hold')
})
test('우선순위는 구조물 의심, 변화 확인, 정규 측량 일정 순이고 묶음 안은 이동 거리가 큰 순', () => {
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
  const t = surveyCsv({ site, rows })
  assert.equal(t.charCodeAt(0), 0xfeff)
  const lines = t.slice(1).split('\r\n').filter(Boolean)
  assert.equal(lines.length, rows.length + 1)
  assert.equal(lines[0], SURVEY_HEAD.join(','))
  assert.equal(lines[1], '1,고성 반암,3,구조물 의심,,41.0,22.9,,,물가선이 구조물이나 암초 위에서 잡힘')
  assert.equal(lines[3], '3,고성 반암,2,변화 확인,후퇴,-30.2,22.9,,,육지 쪽 이동')
  assert.equal(lines[7], '7,고성 반암,4,정규 측량 일정,,,22.9,,,구름으로 해안선 미검출')
})
test('쉼표와 따옴표가 든 값은 따옴표로 감싼다', () => {
  const t = surveyCsv({ site: { id: 'x', name: '가, "나"' }, rows: [rows[0]] })
  assert.match(t, /,"가, ""나""",/)
})
test('빈 목록은 머리 줄만', () => {
  const t = surveyCsv({ site, rows: [] })
  assert.equal(t, '\uFEFF' + SURVEY_HEAD.join(',') + '\r\n')
})
test('파일 이름', () => { assert.equal(surveyFileName(site, '2026-11-04'), 'banam_현장측량구간_2026-11-04.csv') })
test('열 10개: 우선순위, 사업지, 가로선, 판정, 방향, 이동 거리, 보류 기준, 위도, 경도, 판정 내용', () => {
  assert.deepEqual(SURVEY_HEAD, ['우선순위', '사업지', '가로선', '판정', '방향', '이동 거리(m)', '보류 기준(m)', '위도', '경도', '판정 내용'])
})
test('기준 점: 기준 장면 해안선과 가로선이 만나는 점, 만나지 않으면 가로선 중간점', () => {
  const tr = { type: 'LineString', coordinates: [[0, 0], [0.01, 0]] }
  const sh = { type: 'LineString', coordinates: [[0.004, -1], [0.004, 1]] }
  const p = basePoint(tr, sh, 445)
  assert.ok(Math.abs(p.lon - 0.004) < 1e-9); assert.equal(p.lat, 0); assert.equal(p.onShore, true)
  const m = basePoint(tr, { type: 'LineString', coordinates: [[1, 1], [2, 2]] })
  assert.ok(Math.abs(m.lon - 0.005) < 1e-9); assert.equal(m.onShore, false)
  assert.equal(basePoint(null, sh), null)
})

const DATA = fileURLToPath(new URL('../public/data', import.meta.url))
const RULES = `${DATA}/sensitivity_and_rules_v3.json`
const hasBanam = fs.existsSync(RULES) && fs.existsSync(`${DATA}/banam/transects.geojson`)
test('실제 자료 반암 CSV: 36줄 모두 10열, 위경도는 소수 6자리이고 강원 고성 범위, 해안선과 만나는 점', { skip: !hasBanam }, () => {
  const rules = JSON.parse(fs.readFileSync(RULES, 'utf8'))
  const scenes = normalizeShorelines(JSON.parse(fs.readFileSync(`${DATA}/banam/shorelines.geojson`, 'utf8')))
  const base = normalizeTransects(JSON.parse(fs.readFileSync(`${DATA}/banam/transects.geojson`, 'utf8')))
  const rowsB = judgeRows(base, rules.site_rules.banam, rules.scene_rule?.sites?.banam?.periods)
  const t = surveyCsv({ site, rows: rowsB, baseScene: scenes[0] })
  const lines = t.slice(1).split('\r\n').filter(Boolean)
  assert.equal(lines.length, 37)
  let onShore = 0
  for (const l of lines.slice(1)) {
    const c = l.split(',')
    assert.equal(c.length, 10)
    assert.match(c[7], /^\d+\.\d{6}$/); assert.match(c[8], /^\d+\.\d{6}$/)
    const lat = Number(c[7]), lon = Number(c[8])
    assert.ok(lat > 38.2 && lat < 38.6, `위도 ${lat}`)
    assert.ok(lon > 128.3 && lon < 128.7, `경도 ${lon}`)
    assert.ok(['변화 확인', '정규 측량 일정', '구조물 의심'].includes(c[3]))
  }
  for (const r of rowsB) if (basePoint(r.geometry, scenes[0].feature.geometry, r.dist?.[scenes[0].id])?.onShore) onShore += 1
  assert.ok(onShore >= 30, `해안선과 만나는 가로선 ${onShore}개`)
  const groups = lines.slice(1).map((l) => l.split(',')[3])
  assert.deepEqual([...new Set(groups)], ['구조물 의심', '변화 확인', '정규 측량 일정'])
  assert.equal(lines.slice(1).filter((l) => l.split(',')[3] === '변화 확인').length, 7)
  assert.equal(lines.slice(1).filter((l) => l.split(',')[3] === '정규 측량 일정').length, 14)
  assert.equal(lines.slice(1).filter((l) => l.split(',')[3] === '구조물 의심').length, 15)
})

test('현장 측량 구간 CSV 판정 값: 변화 확인, 정규 측량 일정, 구조물 의심', () => {
  const rows = [
    { id: 1, change: 30, threshold: 22.9, verdict: 'advance' }, { id: 2, change: -25, threshold: 22.9, verdict: 'retreat' },
    { id: 3, change: 5, threshold: 22.9, verdict: 'hold' }, { id: 4, change: null, threshold: 22.9, verdict: 'nodata' },
    { id: 5, change: 80, threshold: 22.9, verdict: 'struct' }
  ]
  const lines = surveyCsv({ site: { name: '시험' }, rows }).slice(1).split('\r\n').filter(Boolean)
  assert.equal(lines[0], SURVEY_HEAD.join(','))
  assert.deepEqual(lines.slice(1).map((l) => l.split(',')[3]), ['구조물 의심', '변화 확인', '변화 확인', '정규 측량 일정', '정규 측량 일정'])
  assert.doesNotMatch(lines.join('\n'), /구조물 의심 가로선|기준 초과|판정 보류/)
})
