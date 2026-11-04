import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendixCsv, appendixRows, shorelinesGeojson, transectsGeojson, verdictText } from '../src/lib/docs.js'
import { annexScore, gradeWith, targetShares, tideShift } from '../src/lib/annex.js'
import { mergeRules, parseRunFile, runFile, runToSite } from '../src/lib/runs.js'
import { judgeRows } from '../src/lib/judge.js'

const site = { id: 's', name: '시험 해변' }
const rows = [
  { id: 1, change: 30, threshold: 22.9, verdict: 'advance', geometry: { type: 'LineString', coordinates: [[128, 38], [128.01, 38]] } },
  { id: 2, change: 5, threshold: 22.9, verdict: 'hold', geometry: { type: 'LineString', coordinates: [[128, 38.001], [128.01, 38.001]] } },
  { id: 3, change: 90, threshold: 22.9, verdict: 'struct', geometry: { type: 'LineString', coordinates: [[128, 38.002], [128.01, 38.002]] } }
]

test('가로선 GeoJSON: 가로선마다 Feature 하나, 판정 글자와 이동 거리', () => {
  const g = JSON.parse(transectsGeojson(site, rows))
  assert.equal(g.type, 'FeatureCollection')
  assert.equal(g.features.length, 3)
  assert.equal(g.features[0].properties.verdict, '변화 확인(전진)')
  assert.equal(g.features[2].properties.verdict, '구조물 의심')
  assert.equal(g.features[1].properties.change_m, 5)
  assert.equal(verdictText('few'), '정규 측량 일정')
  assert.equal(g.features[1].properties.verdict, '정규 측량 일정')
})

test('해안선 GeoJSON: 장면마다 Feature 하나', () => {
  const g = JSON.parse(shorelinesGeojson(site, [{ id: 'a', date: '2017-04-13', feature: { geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } } }, { id: 'b', feature: { geometry: null } }]))
  assert.equal(g.features.length, 1)
  assert.equal(g.features[0].properties.scene, 'a')
})

test('판정 부록 CSV: UTF-8 BOM, CRLF, 머리 열, 사업지별 행', () => {
  const list = [{ site, data: { status: 'ready', rows } }, { site: { id: 'x', name: 'X' }, data: { status: 'loading' } }]
  const t = appendixCsv(list)
  assert.equal(t.charCodeAt(0), 0xfeff)
  const lines = t.slice(1).split('\r\n')
  assert.equal(lines[0], '사업지,가로선,이동 거리(m),보류 기준(m),판정,판정 내용')
  assert.equal(lines[1], '시험 해변,1,30.0,22.9,변화 확인(전진),바다 쪽 이동')
  assert.equal(appendixRows(list).length, 3)
})

test('별표 10 계산기: 해빈폭 점수와 목표해안선 적합도, 운영 기준 값을 바꾸면 다시 계산된다', () => {
  // 구조물 의심 제외 두 가로선 평균 17.5 m
  const a = annexScore(rows, { w0: 50, offset: 10 })
  assert.equal(a.mean, 17.5)
  assert.equal(a.beach, 13.5)
  assert.equal(a.b, 0.5)
  assert.equal(a.fit, 30)
  assert.equal(a.sum, 43.5)
  const b = annexScore(rows, { w0: 20, offset: 40 })
  assert.equal(b.beach, 18.8)
  assert.equal(b.fit, 20)
  assert.deepEqual(targetShares(rows, 0), { a: 1, b: 1, n: 2 })
  assert.equal(tideShift(0.3, 0.17), 1.8)
  assert.equal(tideShift(1, 0), null)
  assert.equal(gradeWith(43.5, 30), 'C')
  assert.equal(gradeWith(60, 30), 'A')
})

test('새 분석 결과: 사업지 자료로 바꾸고 파일로 내려받아 다시 불러와도 판정이 같다', () => {
  const base = [
    { id: 1, change: 30, dist: { a: 200, b: 202, c: 230, d: 232 }, samepair: { p0: 2, p1: 2 }, geometry: rows[0].geometry },
    { id: 2, change: 30, dist: { a: 200, b: 202, c: 230, d: 232 }, samepair: { p0: 2, p1: 2 }, geometry: rows[1].geometry, struct: true }
  ]
  const result = {
    params: { lon: 128, lat: 38, beforeYear: 2017, afterYear: 2025 },
    meta: { season: '봄' }, periods: { 2017: ['a', 'b'], 2025: ['c', 'd'] }, structureIds: [2],
    scenes: [{ id: 'a', date: '2017-04-01' }, { id: 'b', date: '2017-04-11' }, { id: 'c', date: '2025-04-01' }, { id: 'd', date: '2025-04-11' }], base
  }
  const run = runToSite(result, { id: 'run1', name: '새 사업지 1', korea: { holdThresholdM: 22.9, p95: { threshold_m: 44.9 } } })
  assert.equal(run.data.summary.judgeable, 1)
  assert.equal(run.data.summary.excluded, 1)
  const back = parseRunFile(runFile(run))
  assert.deepEqual(back.data.rows.map((r) => r.verdict), run.data.rows.map((r) => r.verdict))
  assert.throws(() => parseRunFile('{"kind":"x"}'))
  const merged = mergeRules({ site_rules: { banam: {} }, scene_rule: { sites: {} } }, [run])
  assert.equal(merged.site_rules.run1.holdThresholdM, 22.9)
  assert.deepEqual(merged.scene_rule.sites.run1.periods, result.periods)
  // 95% 기준이면 30 m 는 판정 보류
  const p95 = judgeRows(run.data.base, merged.site_rules.run1, result.periods, 'p95')
  assert.equal(p95[0].verdict, 'hold')
  // 시점별 최소 장면 3장이면 판정 보류
  const min3 = judgeRows(run.data.base, merged.site_rules.run1, result.periods, 'sd1', 3)
  assert.equal(min3[0].verdict, 'few')
})

test('구조물 구간 불러오기: 이어지는 번호끼리 묶어 묶음마다 사각형 하나', async () => {
  const { idRuns, structurePolygons } = await import('../src/lib/structures.js')
  assert.deepEqual(idRuns([8, 9, 10, 24, 25, 33, 34, 12]), [[8, 9, 10], [12], [24, 25], [33, 34]])
  const tr = (id, y) => ({ id, geometry: { type: 'LineString', coordinates: [[128.45, y], [128.46, y]] } })
  const rows = [tr(1, 38.40), tr(2, 38.401), tr(3, 38.402), tr(5, 38.404)]
  const p = structurePolygons(rows, [1, 2, 3, 5, 9])
  assert.equal(p.length, 2)
  assert.deepEqual(p[0], [[128.45, 38.40], [128.46, 38.40], [128.46, 38.402], [128.45, 38.402]])
  assert.deepEqual(p[1], [[128.45, 38.404], [128.46, 38.404], [128.46, 38.404], [128.45, 38.404]])
})
