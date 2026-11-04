import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { judgeRows, summarize, sceneJudge, axisRows } from '../src/lib/judge.js'
import { normalizeTransects, normalizeShorelines } from '../src/lib/loader-core.js'

const POC2 = process.env.COAST_POC2_DIR || fileURLToPath(new URL('../public/data', import.meta.url))
const RULES = `${POC2}/sensitivity_and_rules_v3.json`
const rules = fs.existsSync(RULES) ? JSON.parse(fs.readFileSync(RULES, 'utf8')) : null
const has = (id) => rules && fs.existsSync(`${POC2}/${id}/transects.geojson`)
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
// 앱 loadSite 와 withBasis 와 같은 순서로 사이트 자료를 만든다
function siteData(id, basis = 'sd1') {
  const base = normalizeTransects(read(`${POC2}/${id}/transects.geojson`))
  const scenes = normalizeShorelines(read(`${POC2}/${id}/shorelines.geojson`))
  const rule = rules.site_rules[id]
  const periods = rules.scene_rule.sites[id].periods
  const rows = judgeRows(base, rule, periods, basis)
  return { d: { status: 'ready', scenes, base, rows, summary: summarize(rows) }, rule, periods }
}
const pick = (s) => ({ judgeable: s.judgeable, held: s.held, excluded: s.excluded, advance: s.advance, retreat: s.retreat })

test('장면별 판정: 카드와 같은 judgeRows 를 써서 장면 규칙이 걸린 가로선은 few', () => {
  const base = [
    { id: 1, threshold: 10, samepair: { a: 1 }, dist: { a: 100, b: 70, c: 60 } },
    { id: 2, threshold: 10, samepair: { a: 1 }, dist: { a: 100, b: 70 } }
  ]
  const rule = { holdThresholdM: 10 }
  const periods = { p1: ['a', 'b'], p2: ['c', 'b'] }
  const r = sceneJudge(base, 'a', 'b', rule, periods)
  assert.equal(r[0].change, 30); assert.equal(r[0].verdict, 'advance')
  assert.equal(r[1].verdict, 'few')
})
test('장면별 판정: 구조물 의심 제외와 보류 기준 선택을 반영', () => {
  const base = [{ id: 1, threshold: 10, samepair: { a: 1 }, dist: { a: 100, b: 70, c: 60, d: 50 } }, { id: 2, threshold: 10, samepair: { a: 1 }, dist: { a: 100, b: 70, c: 60, d: 50 } }]
  const periods = { p1: ['a', 'b'], p2: ['c', 'd'] }
  const rule = { holdThresholdM: 10, p95: { threshold_m: 40 }, structureExcluded: [2] }
  assert.equal(sceneJudge(base, 'a', 'b', rule, periods, 'sd1')[0].verdict, 'advance')
  assert.equal(sceneJudge(base, 'a', 'b', rule, periods, 'p95')[0].verdict, 'hold')
  assert.equal(sceneJudge(base, 'a', 'b', rule, periods)[1].verdict, 'struct')
})

test('반암: 시간 축 마지막 장면 개수가 판정 카드 개수와 같다(두 보류 기준)', { skip: !has('banam') }, () => {
  for (const basis of ['sd1', 'p95']) {
    const { d, rule, periods } = siteData('banam', basis)
    const ax = axisRows(d, d.scenes.length - 1, rule, periods, basis)
    assert.equal(ax.mode, 'final')
    assert.deepEqual(pick(summarize(ax.rows)), pick(d.summary))
  }
  const { d } = siteData('banam')
  assert.deepEqual(pick(d.summary), { judgeable: 7, held: 14, excluded: 15, advance: 7, retreat: 0 })
})
test('반암: 중간 장면은 비교 장면 기준으로 세고 구조물 의심 15개는 계속 제외', { skip: !has('banam') }, () => {
  const { d, rule, periods } = siteData('banam')
  for (let i = 0; i < d.scenes.length - 1; i += 1) {
    const ax = axisRows(d, i, rule, periods)
    assert.equal(ax.mode, 'scene')
    const s = summarize(ax.rows)
    assert.equal(s.excluded, 15)
    assert.equal(s.judgeable + s.held + s.excluded, 36)
  }
  assert.equal(summarize(axisRows(d, 0, rule, periods).rows).judgeable, 0)
})
test('토고 Agbodrafo: 앱 기준 초과 16개, 시간 축 마지막 장면도 16개(규칙 파일 17은 쓰지 않음)', { skip: !has('aneho') }, () => {
  const { d, rule, periods } = siteData('aneho')
  assert.equal(rules.site_rules.aneho.judgeableCount, 17)
  assert.equal(d.summary.judgeable, 16)
  assert.equal(summarize(axisRows(d, d.scenes.length - 1, rule, periods).rows).judgeable, 16)
})
