import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ruleVerdict, applySiteRule, applySceneRule, sceneCount, summarize, beachWidthScore, targetFitScore, gradeOf, roleOf, scoresSite } from '../src/lib/judge.js'
import { normalizeTransects, samepairFromCorrected, sensitivityFor, scoreInputsFor, errorSizeFor } from '../src/lib/loader-core.js'
import { ledgerText } from '../src/lib/ledger.js'

const POC2 = process.env.COAST_POC2_DIR || '/Users/juhyunho/.aside/u/0/sessions/2026-11-03_jTs26DB0VbkJB83T/artifacts/erosion_poc2'
const RULES = `${POC2}/sensitivity_and_rules_v2.json`

test('규칙 판정: 기준 이하는 보류, 기준과 같아도 보류', () => {
  assert.equal(ruleVerdict(10, 10, {}), 'hold')
  assert.equal(ruleVerdict(-10.1, 10, { 2025: 2 }), 'retreat')
  assert.equal(ruleVerdict(30, 10, { 2017: 1 }), 'advance')
  assert.equal(ruleVerdict(30, 10, {}), 'hold')
})
test('규칙 판정: 같은 계절 장면쌍 차이가 기준을 넘으면 보류', () => {
  assert.equal(ruleVerdict(90, 13.4, { 2017: 0.5, 2025: 127.1 }), 'hold')
})
test('규칙 판정: 값이 없으면 nodata, 기준이 없으면 보류', () => {
  assert.equal(ruleVerdict(null, 10, {}), 'nodata')
  assert.equal(ruleVerdict(30, null, {}), 'hold')
})
test('규칙이 없으면 가로선 파일 판정을 그대로 둔다', () => {
  const rows = [{ id: 1, change: 30, threshold: 5, verdict: 'advance' }]
  assert.equal(applySiteRule(rows, null), rows)
})

const rules = fs.existsSync(RULES) ? JSON.parse(fs.readFileSync(RULES, 'utf8')) : null
const has = (id) => rules && fs.existsSync(`${POC2}/${id}/transects.geojson`)
function siteRows(id) {
  let base = normalizeTransects(JSON.parse(fs.readFileSync(`${POC2}/${id}/transects.geojson`, 'utf8')))
  if (id === 'sandmotor') base = samepairFromCorrected(base, JSON.parse(fs.readFileSync(`${POC2}/sites/sandmotor_spring_vs_jarkus_rows.json`, 'utf8')))
  return applySceneRule(applySiteRule(base, rules.site_rules[id]), rules.scene_rule.sites[id].periods)
}
// 5차 분석(poc5) 값: 한국 기준 22.9 m, 장면 규칙 통일 뒤 판정 가능 개수
const EXPECT = {
  banam: { total: 36, judgeable: 13, advance: 13, retreat: 0, t: 22.9 },
  jinjin: { total: 37, judgeable: 0, advance: 0, retreat: 0, t: 22.9 },
  hwajinpo: { total: 16, judgeable: 0, advance: 0, retreat: 0, t: 22.9 },
  aneho: { total: 102, judgeable: 16, advance: 9, retreat: 7, t: 16.6 },
  sandmotor: { total: 37, judgeable: 17, advance: 4, retreat: 13, t: 57.2 }
}
for (const [id, e] of Object.entries(EXPECT)) {
  test(`실제 자료 ${id}: 보류 기준 ${e.t} m와 장면 규칙으로 판정 가능 ${e.judgeable}/${e.total}`, { skip: !has(id) }, () => {
    const s = summarize(siteRows(id))
    assert.equal(s.total, e.total); assert.equal(s.judgeable, e.judgeable)
    assert.equal(s.advance, e.advance); assert.equal(s.retreat, e.retreat)
    assert.deepEqual(s.thresholds, [e.t])
    assert.equal(s.judgeable, rules.scene_rule.sites[id].judgeableUnderRule)
  })
}
test('한국 사업지 기준: 동해안 사전 오차 16.21 m x 루트 2 = 22.9 m', { skip: !rules }, () => {
  for (const id of ['banam', 'jinjin', 'hwajinpo']) {
    assert.equal(rules.site_rules[id].holdThresholdM, 22.9)
    assert.equal(Math.round(16.21 * Math.SQRT2 * 10) / 10, rules.site_rules[id].holdThresholdM)
  }
})
test('사이트 구분: 화진포는 대조 해변이라 점수 계산 없음, 반암과 가진은 사업지', { skip: !rules }, () => {
  assert.equal(roleOf(rules.site_rules.hwajinpo), 'control'); assert.equal(scoresSite(rules.site_rules.hwajinpo), false)
  assert.equal(roleOf(rules.site_rules.banam), 'project'); assert.equal(roleOf(rules.site_rules.jinjin), 'project')
  assert.equal(roleOf(null), 'project')
})
test('장면 규칙: 한 시점 장면이 1장이면 판정 가능 가로선도 보류(few)', () => {
  const periods = { 2017: ['a', 'b'], 2025: ['c', 'd'] }
  const rows = [
    { id: 1, change: 40, verdict: 'advance', dist: { a: 1, b: 2, c: 3, d: 4 } },
    { id: 2, change: 40, verdict: 'advance', dist: { a: 1, b: null, c: 3, d: 4 } },
    { id: 3, change: 5, verdict: 'hold', dist: { a: 1, c: 3 } }
  ]
  const out = applySceneRule(rows, periods)
  assert.deepEqual(out.map((r) => r.verdict), ['advance', 'few', 'hold'])
  assert.deepEqual(sceneCount(rows[1].dist, periods), { 2017: 1, 2025: 2 })
  assert.equal(summarize(out).held, 2)
})
test('장면 규칙: 시점 정보가 없으면 그대로 둔다', () => {
  const rows = [{ id: 1, change: 40, verdict: 'advance', dist: {} }]
  assert.equal(applySceneRule(rows, null), rows)
})
test('구간 평균: 판정 보류 가로선을 포함한 값이 있는 가로선 전체 평균', () => {
  const rows = [
    { id: 1, change: 60, verdict: 'advance' }, { id: 2, change: 10, verdict: 'hold' },
    { id: 3, change: null, verdict: 'nodata' }, { id: 4, change: -10, verdict: 'hold' }
  ]
  const s = summarize(rows)
  assert.equal(s.sectionMean, 20); assert.equal(s.sectionN, 3); assert.equal(s.meanChange, 60)
})
test('반암 구간 평균이 규칙 파일 사이트 평균(46.3 m)과 같고 카드와 대장 문구가 같은 값을 쓴다', { skip: !has('banam') }, () => {
  const rows = siteRows('banam')
  const s = summarize(rows)
  assert.equal(s.sectionMean, 46.3); assert.equal(s.sectionN, 35)
  const bias = rules.sensitivity.find((e) => e.errorM === 16.21 && e.errorMode === 'bias_independent')
  assert.equal(s.sectionMean, bias.bySite.banam.trueMeanChangeM)
  const t = ledgerText({ site: { name: '고성 반암' }, rows, period: { from: '2017-04-13', to: '2025-05-30' }, today: '2026-11-03' })
  assert.match(t, /고성 반암 구간 평균 해빈폭 \+46\.3 m 변화\(값이 있는 가로선 35개 평균, 판정 보류 포함\)\./)
  assert.equal(beachWidthScore(100, s.sectionMean), 14.6)
})
test('오차 크기 선택: 한국 16.21 m, Sand Motor 42.3 m, 아네호 13.2 m', { skip: !rules }, () => {
  assert.equal(errorSizeFor(rules, 'banam'), 16.21); assert.equal(errorSizeFor(rules, 'jinjin'), 16.21)
  assert.equal(errorSizeFor(rules, 'sandmotor'), 42.3); assert.equal(errorSizeFor(rules, 'aneho'), 13.2)
})
test('민감도 표: 반암과 가진 치우침, 혼합, 흩어짐 합계 변동(poc5 2-2)', { skip: !rules }, () => {
  const b = sensitivityFor(rules, 'banam')
  assert.deepEqual(b.rows.map((r) => r.label), ['치우침', '혼합', '흩어짐'])
  assert.deepEqual(b.rows.map((r) => r.total), [6.1, 4.19, 1.69])
  assert.deepEqual(b.rows.map((r) => r.beachWidth), [4.67, 2.85, 0.78])
  assert.equal(b.rows[0].corr, 0.86); assert.equal(b.rows[0].pGrade, 0.461)
  const j = sensitivityFor(rules, 'jinjin')
  assert.deepEqual(j.rows.map((r) => r.total), [8.37, 5.05, 1.65])
  assert.deepEqual(j.rows.map((r) => r.fit), [6.17, 3.51, 1.31])
  assert.equal(sensitivityFor(rules, 'hwajinpo'), null)
})
test('별표 10 입력: 반암 목표해안선 위치별 적합도와 해빈폭별 점수 변동', { skip: !rules }, () => {
  const x = scoreInputsFor(rules, 'banam')
  assert.deepEqual(x.targetFit.map((t) => t.score), [25.7, 27.4, 28, 25.1])
  assert.equal(x.beachWidth.find((b) => b.w0 === 50).sd, 4.67)
  assert.equal(scoreInputsFor(rules, 'hwajinpo'), null)
})

test('별표 10 해빈폭 점수: 10 + 10 x 변화율, 10점에서 20점', () => {
  assert.equal(beachWidthScore(50, 10), 12)
  assert.equal(beachWidthScore(50, -5), 10)
  assert.equal(beachWidthScore(20, 40), 20)
  assert.equal(beachWidthScore(0, 10), null)
})
test('별표 10 목표해안선 적합도: 20 + 20 x (B - A), 20점에서 40점', () => {
  assert.equal(targetFitScore(0.5, 0.8), 26)
  assert.equal(targetFitScore(0.9, 0.2), 20)
  assert.equal(targetFitScore(0, 1.5), 40)
})
test('별표 10 등급 구간', () => {
  assert.equal(gradeOf(85), 'A'); assert.equal(gradeOf(84.9), 'B'); assert.equal(gradeOf(75), 'B')
  assert.equal(gradeOf(65), 'C'); assert.equal(gradeOf(55), 'D'); assert.equal(gradeOf(54.9), 'E')
})
