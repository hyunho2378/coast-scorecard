import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fetchJsonOptional, normalizeShorelines, normalizeTransects, periodOf, rulesForSite, bandOf } from '../src/lib/loader-core.js'

const POC2 = process.env.COAST_POC2_DIR || fileURLToPath(new URL('../public/data', import.meta.url))
const fakeRes = (status, body, type = 'application/json') => ({ ok: status < 400, status, headers: { get: () => type }, json: async () => body })

test('MultiLineString 해안선은 조각을 모두 남긴다', () => {
  const fc = { features: [
    { properties: { scene: 's1', date: '2017-04-13', tide_corrected: false }, geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]], [[2, 2], [3, 3]], [[9, 9]]] } },
    { properties: { scene: 's2', date: '2025-04-26' }, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }
  ] }
  const s = normalizeShorelines(fc)
  assert.equal(s[0].segments, 2)
  assert.equal(s[0].feature.geometry.type, 'MultiLineString')
  assert.equal(s[1].segments, 1)
  assert.equal(s[1].feature.geometry.type, 'LineString')
})
test('빈 장면 도형은 null 로 둔다', () => {
  const s = normalizeShorelines({ features: [{ properties: { scene: 'x', date: '2020-01-01' }, geometry: null }] })
  assert.equal(s[0].segments, 0); assert.equal(s[0].feature.geometry, null)
})
test('없는 파일은 missing, 예외 없이', async () => {
  const r = await fetchJsonOptional('/x.json', async () => fakeRes(404, null, 'text/plain'))
  assert.equal(r.status, 'missing')
})
test('개발 서버의 HTML 대체 응답도 missing', async () => {
  const r = await fetchJsonOptional('/x.json', async () => fakeRes(200, null, 'text/html'))
  assert.equal(r.status, 'missing')
})
test('네트워크 실패는 error', async () => {
  const r = await fetchJsonOptional('/x.json', async () => { throw new Error('끊김') })
  assert.equal(r.status, 'error'); assert.match(r.message, /끊김/)
})
test('가로선: 파일의 hold 와 기준을 그대로 쓴다', () => {
  const rows = normalizeTransects({ features: [
    { properties: { id: 1, change_m: 15.04, hold: true, hold_threshold_m: 16.5, tide_corrected: false }, geometry: {} },
    { properties: { id: 2, change_m: -30, hold: false, hold_threshold_m: 26.4, tide_corrected: true }, geometry: {} },
    { properties: { id: 3, change_m: null, hold: true, hold_threshold_m: 13.4 }, geometry: {} }
  ] })
  assert.deepEqual(rows.map((r) => r.verdict), ['hold', 'retreat', 'nodata'])
  assert.equal(rows[0].change, 15); assert.equal(rows[1].threshold, 26.4)
})
test('비교 기간과 사용 연도', () => {
  const p = periodOf([{ date: '2025-01-07' }, { date: '2021-12-24' }, { date: '2022-01-28' }])
  assert.equal(p.from, '2021-12-24'); assert.equal(p.to, '2025-01-07'); assert.deepEqual(p.years, ['2021', '2022', '2025'])
})
test('규칙 파일 사업지 항목 찾기와 없는 경우', () => {
  assert.equal(rulesForSite(null, 'a'), null)
  assert.equal(rulesForSite({ sites: { a: { grade_band_m: 3 } } }, 'a').grade_band_m, 3)
  assert.equal(rulesForSite({ sites: [{ id: 'b', band_m: 2 }] }, 'b').band_m, 2)
  assert.deepEqual(bandOf({ band_m: 2 }), { value: 2, key: 'band_m' })
  assert.equal(bandOf({}), null)
})
for (const id of ['hwajinpo', 'banam', 'jinjin', 'aneho', 'sandmotor']) {
  test(`실제 자료 ${id}: 장면과 가로선 읽기`, { skip: !fs.existsSync(`${POC2}/${id}`) }, () => {
    const sh = normalizeShorelines(JSON.parse(fs.readFileSync(`${POC2}/${id}/shorelines.geojson`, 'utf8')))
    const tr = normalizeTransects(JSON.parse(fs.readFileSync(`${POC2}/${id}/transects.geojson`, 'utf8')))
    assert.ok(sh.length >= 2); assert.ok(tr.length > 0)
    for (const s of sh) assert.ok(s.segments >= 1)
    for (const r of tr) assert.ok(typeof r.threshold === 'number')
  })
}

const RULES = {
  site_rules: { a: { holdThresholdM: 57.2, surveyAvailable: true, judgeableCount: 17 }, b: { holdThresholdM: 10, surveyAvailable: false } },
  sensitivity: [
    { errorM: 13.2, errorKind: '단일 시점 위치 RMSE', gradeChange: [{ W0_m: 20, boundary_band_beachwidth_change_m: 36.6, p_grade_change: 0.609 }], targetFitScore: { b: { runs: [{ true_score: 28.8, p05: 22.5, p95: 31.2 }] } } },
    { errorM: 42.3, errorKind: '두 시점 변화량 RMSE', gradeChange: [{ W0_m: 20, boundary_band_beachwidth_change_m: 39.2, p_grade_change: 0.631 }], targetFitScore: {} }
  ],
  type_rules: { structures: { label: '돌제, 잠제, 이안제', app_wording: '구조물 지구: 배후 구간과 하류 인접 구간 함께 표시' } }
}
test('등급 민감도: 측량 대조 사업지는 변화량 오차 항목', async () => {
  const { gradeSensitivity } = await import('../src/lib/loader-core.js')
  assert.equal(gradeSensitivity(RULES, 'a').bandM, 39.2)
  const b = gradeSensitivity(RULES, 'b')
  assert.equal(b.bandM, 36.6); assert.equal(b.targetFit.p05, 22.5)
  assert.equal(gradeSensitivity(null, 'a'), null)
})
test('보류 기준 대조: 규칙 파일과 가로선 파일 값이 다르면 same=false', async () => {
  const { holdRuleCheck } = await import('../src/lib/loader-core.js')
  assert.equal(holdRuleCheck(RULES, 'a', { thresholds: [26.4] }).same, false)
  assert.equal(holdRuleCheck(RULES, 'b', { thresholds: [10] }).same, true)
  assert.equal(holdRuleCheck(RULES, 'z', { thresholds: [10] }), null)
})
test('사업 유형 해석 규칙', async () => {
  const { typeRulesFor } = await import('../src/lib/loader-core.js')
  assert.deepEqual(typeRulesFor(RULES, ['structures', 'none']).map((x) => x.label), ['돌제와 잠제, 이안제'])
})
