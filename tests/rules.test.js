import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ruleVerdict, applySiteRule, applySceneRule, applyStructureRule, judgeRows, thresholdOf, sceneChanges, sceneCount, summarize, beachWidthScore, targetFitScore, gradeOf, roleOf, scoresSite } from '../src/lib/judge.js'
import { normalizeTransects, samepairFromCorrected, scoreInputsFor, errorSizeFor, unifiedFor, typeRulesFor, projectFactsFor, nextCandidates, yearThresholdRows, falsePositiveRows } from '../src/lib/loader-core.js'
import { ledgerText } from '../src/lib/ledger.js'

const POC2 = process.env.COAST_POC2_DIR || '/Users/juhyunho/.aside/u/0/sessions/2026-11-03_jTs26DB0VbkJB83T/artifacts/erosion_poc2'
const RULES = `${POC2}/sensitivity_and_rules_v3.json`

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
function siteRows(id, basis = 'sd1') {
  let base = normalizeTransects(JSON.parse(fs.readFileSync(`${POC2}/${id}/transects.geojson`, 'utf8')))
  if (id === 'sandmotor') base = samepairFromCorrected(base, JSON.parse(fs.readFileSync(`${POC2}/sites/sandmotor_spring_vs_jarkus_rows.json`, 'utf8')))
  return judgeRows(base, rules.site_rules[id], rules.scene_rule.sites[id].periods, basis)
}
// 6차 분석(poc6) 값: 한국 기준 22.9 m, 반암 구조물 의심 15개 제외, 장면 규칙 뒤 기준 초과 개수
const EXPECT = {
  banam: { total: 36, judgeable: 7, advance: 7, retreat: 0, t: 22.9 },
  jinjin: { total: 37, judgeable: 0, advance: 0, retreat: 0, t: 22.9 },
  hwajinpo: { total: 16, judgeable: 0, advance: 0, retreat: 0, t: 22.9 },
  aneho: { total: 102, judgeable: 16, advance: 9, retreat: 7, t: 16.6 },
  sandmotor: { total: 37, judgeable: 17, advance: 4, retreat: 13, t: 57.2 }
}
for (const [id, e] of Object.entries(EXPECT)) {
  test(`실제 자료 ${id}: 보류 기준 ${e.t} m와 장면 규칙으로 기준 초과 ${e.judgeable}/${e.total}`, { skip: !has(id) }, () => {
    const s = summarize(siteRows(id))
    assert.equal(s.total, e.total); assert.equal(s.judgeable, e.judgeable)
    assert.equal(s.advance, e.advance); assert.equal(s.retreat, e.retreat)
    assert.deepEqual(s.thresholds, [e.t])
    assert.equal(s.judgeable, id === 'aneho' ? rules.scene_rule.sites[id].judgeableUnderRule : rules.site_rules[id].judgeableCount)
  })
}
test('한국 사업지 기준: 동해안 사전 오차 16.21 m x 루트 2 = 22.9 m', { skip: !rules }, () => {
  for (const id of ['banam', 'jinjin', 'hwajinpo']) {
    assert.equal(rules.site_rules[id].holdThresholdM, 22.9)
    assert.equal(Math.round(16.21 * Math.SQRT2 * 10) / 10, rules.site_rules[id].holdThresholdM)
  }
})
test('사이트 구분: 화진포는 비교 해변이라 점수 계산 없음, 반암과 가진은 사업지', { skip: !rules }, () => {
  assert.equal(roleOf(rules.site_rules.hwajinpo), 'control'); assert.equal(scoresSite(rules.site_rules.hwajinpo), false)
  assert.equal(roleOf(rules.site_rules.banam), 'project'); assert.equal(roleOf(rules.site_rules.jinjin), 'project')
  assert.equal(roleOf(null), 'project')
})
test('장면 규칙: 한 시점 장면이 1장이면 기준 초과 가로선도 보류(few)', () => {
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
test('반암 기준 초과 7/36: 26번에서 32번, 모두 전진, +23.9 m에서 +41.2 m', { skip: !has('banam') }, () => {
  const rows = siteRows('banam')
  const ok = rows.filter((r) => r.verdict === 'advance' || r.verdict === 'retreat')
  assert.deepEqual(ok.map((r) => r.id), [26, 27, 28, 29, 30, 31, 32])
  assert.deepEqual(ok.map((r) => r.id), rules.site_rules.banam.judgeableIds)
  assert.equal(Math.min(...ok.map((r) => r.change)), 23.9); assert.equal(Math.max(...ok.map((r) => r.change)), 41.2)
})
test('반암 구조물 의심 15개는 판정 열에 구조물 의심, 제외(10, 15, 24, 33번 포함)', { skip: !has('banam') }, () => {
  const rows = siteRows('banam')
  const st = rows.filter((r) => r.verdict === 'struct').map((r) => r.id)
  assert.equal(st.length, 15)
  assert.deepEqual(st, rules.site_rules.banam.structureExcluded)
  for (const id of [10, 15, 24, 33]) assert.ok(st.includes(id))
  const s = summarize(rows)
  assert.equal(s.excluded, 15); assert.equal(s.held, 14); assert.equal(s.judgeable + s.held + s.excluded, 36)
})
test('반암 구간 평균: 구조물 의심을 뺀 가로선 20개 +16.0 m, 민감도 표 출발점과 같다', { skip: !has('banam') }, () => {
  const rows = siteRows('banam')
  const s = summarize(rows)
  assert.equal(s.sectionMean, 16.0); assert.equal(s.sectionN, 20)
  const u = unifiedFor(rules, 'banam')
  assert.equal(u.meanChange, s.sectionMean); assert.equal(u.nTransects, 20)
  assert.equal(beachWidthScore(50, s.sectionMean), u.beachWidthTrue)
  const t = ledgerText({ site: { name: '고성 반암' }, rows, period: { from: '2017-04-13', to: '2025-05-30' }, today: '2026-11-03' })
  assert.match(t, /고성 반암 구간 평균 해빈폭 \+16\.0 m 변화/)
  assert.doesNotMatch(t, /가로선 (10|15|24|33)번/)
})
test('반암 대장 문구: 기준 초과 7개(보류 기준 22.9 m, 판정 대상 20개 중), 보류 14개, 구조물 의심 15개', { skip: !has('banam') }, () => {
  const rows = siteRows('banam')
  const fp = falsePositiveRows(rules).find((x) => x.basis === 'sd1')
  assert.equal(fp.n, 20); assert.equal(fp.label, '기본')
  const t = ledgerText({ site: { name: '고성 반암' }, rows, period: { from: '2017-04-13', to: '2025-05-30' }, today: '2026-11-03' }).split('\n')
  assert.equal(t[1], '기준 초과 7개(보류 기준 22.9 m 초과, 판정 대상 20개 중), 보류 14개, 구조물 의심 15개')
  assert.doesNotMatch(t.join('\n'), /기대 수|6\.3개/)
  assert.match(t.join('\n'), /가로선 26번 해빈폭 \+41\.2 m 변화\(판정 보류 기준 22\.9 m\), 기준 초과 전진\./)
  assert.equal(falsePositiveRows(rules).find((x) => x.basis === 'p95').expected, 1.0)
})
test('기준 선택: 엄격 44.9 m에서 반암 0개, 기본값은 22.9 m', { skip: !has('banam') }, () => {
  assert.equal(thresholdOf(rules.site_rules.banam), 22.9)
  assert.equal(thresholdOf(rules.site_rules.banam, 'p95'), 44.9)
  assert.equal(thresholdOf(rules.site_rules.sandmotor, 'p95'), 57.2)
  const s = summarize(siteRows('banam', 'p95'))
  assert.equal(s.judgeable, 0); assert.equal(s.excluded, 15); assert.deepEqual(s.thresholds, [44.9])
  assert.equal(summarize(siteRows('jinjin', 'p95')).judgeable, 0)
  assert.equal(summarize(siteRows('hwajinpo', 'p95')).judgeable, 0)
})
test('구조물 제외 규칙: 번호 목록이 없으면 그대로, 장면별 비교에서도 구조물 의심 유지', () => {
  const rows = [{ id: 1, change: 50, verdict: 'advance', dist: { a: 0, b: 50 } }, { id: 2, change: 30, verdict: 'advance', dist: { a: 0, b: 30 } }]
  assert.equal(applyStructureRule(rows, null), rows)
  const out = applyStructureRule(rows, [2])
  assert.deepEqual(out.map((r) => r.verdict), ['advance', 'struct'])
  assert.equal(sceneChanges(out.map((r) => ({ ...r, threshold: 10 })), 'b', 'a')[1].verdict, 'struct')
})
test('연도별 큰 값과 거짓 판정 비율', { skip: !rules }, () => {
  const y = yearThresholdRows(rules)
  const all = y.find((r) => r.id === 'banam' && r.part === 'all')
  const ex = y.find((r) => r.id === 'banam' && r.part === 'excl')
  assert.equal(all.maxYear, 79.9); assert.equal(all.sd1.judgeable, 4)
  assert.equal(ex.maxYear, 6.3); assert.equal(ex.sd1.judgeable, 7); assert.equal(ex.p95.judgeable, 0)
  const f = falsePositiveRows(rules)
  assert.deepEqual(f.map((r) => [r.thresholdM, r.rate, r.n, r.expected, r.judgeable]), [[22.9, 0.317, 20, 6.3, 7], [44.9, 0.05, 20, 1.0, 0]])
})
test('민감도 한 표: 상하한 적용 전과 후 열(poc6 4-2)', { skip: !rules }, () => {
  const b = unifiedFor(rules, 'banam')
  assert.equal(b.site, '반암 구조물 의심 제외')
  assert.deepEqual(b.rows.map((r) => r.label), ['치우침, 두 시점 독립', '혼합', '흩어짐', '치우침, 두 시점 같음'])
  assert.deepEqual(b.rows[0].total, [9.73, 7.42]); assert.deepEqual(b.rows[0].beachWidth, [4.58, 3.35])
  const j = unifiedFor(rules, 'jinjin')
  assert.equal(j.site, '가진 전체')
  assert.deepEqual(j.rows.map((r) => r.total), [[14.47, 8.39], [8.59, 5.01], [2.72, 1.64], [1.42, 0.97]])
  assert.equal(unifiedFor(rules, 'hwajinpo'), null); assert.equal(unifiedFor(rules, 'sandmotor'), null)
})
test('사업비와 다음 적용 후보', { skip: !rules }, () => {
  assert.deepEqual(projectFactsFor(rules, 'banam'), { amountMillion: 10549, eok: 105, legal: false })
  assert.deepEqual(projectFactsFor(rules, 'jinjin'), { amountMillion: 11887, eok: 119, legal: false })
  assert.equal(projectFactsFor(rules, 'hwajinpo'), null)
  assert.deepEqual(nextCandidates(rules).map((c) => c.name), ['고성 봉포지구', '삼척 월천지구', '속초 속초해수욕장'])
})
test('화진포 비교 해변: 실태조사 등급 2021년 D, 2022년에서 2025년 C', { skip: !has('hwajinpo') }, () => {
  const g = rules.site_rules.hwajinpo.surveyGrades
  assert.deepEqual([g['2021'], g['2022'], g['2023'], g['2024'], g['2025']], ['D', 'C', 'C', 'C', 'C'])
  const ch = siteRows('hwajinpo').map((r) => r.change).filter((v) => typeof v === 'number')
  assert.equal(Math.min(...ch), 6.7); assert.equal(Math.max(...ch), 22.9)
})
test('사업 유형 문구: 화면 문장은 쉼표 2개 이하이고 개조식 끝맺음이 없다', { skip: !rules }, () => {
  const t = typeRulesFor(rules, ['structures', 'nourishment', 'seasonal'])
  assert.deepEqual(t.map((x) => x.label), ['돌제와 잠제, 이안제', '양빈', '계절 비교'])
  for (const x of t) {
    for (const sentence of x.text.split('. ')) assert.ok((sentence.match(/,/g) || []).length <= 2, sentence)
    assert.doesNotMatch(x.text, /함\.$|임\.$/)
    assert.match(x.text, /니다\.$/)
  }
})
test('해외 사이트 별표 10 입력은 오차 크기별 항목을 쓴다', { skip: !rules }, () => {
  assert.equal(errorSizeFor(rules, 'sandmotor'), 42.3); assert.equal(errorSizeFor(rules, 'aneho'), 13.2)
  assert.ok(scoreInputsFor(rules, 'aneho').targetFit.length > 0)
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
