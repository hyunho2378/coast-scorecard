import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ruleVerdict, applySiteRule, summarize, beachWidthScore, targetFitScore, gradeOf } from '../src/lib/judge.js'
import { normalizeTransects, samepairFromCorrected } from '../src/lib/loader-core.js'

const POC2 = process.env.COAST_POC2_DIR || '/Users/juhyunho/.aside/u/0/sessions/2026-11-03_jTs26DB0VbkJB83T/artifacts/erosion_poc2'
const RULES = `${POC2}/sensitivity_and_rules.json`

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
for (const id of ['hwajinpo', 'banam', 'jinjin', 'aneho', 'sandmotor']) {
  test(`실제 자료 ${id}: 규칙 파일 기준으로 판정 가능 개수가 규칙 파일과 같다`, { skip: !rules || !fs.existsSync(`${POC2}/${id}/transects.geojson`) }, () => {
    const rule = rules.site_rules[id]
    let base = normalizeTransects(JSON.parse(fs.readFileSync(`${POC2}/${id}/transects.geojson`, 'utf8')))
    if (id === 'sandmotor') base = samepairFromCorrected(base, JSON.parse(fs.readFileSync(`${POC2}/sites/sandmotor_spring_vs_jarkus_rows.json`, 'utf8')))
    const rows = applySiteRule(base, rule)
    const s = summarize(rows)
    assert.equal(s.total, rule.nTransects)
    assert.equal(s.judgeable, rule.judgeableCount)
    assert.equal(s.advance, rule.advance)
    assert.equal(s.retreat, rule.retreat)
    assert.deepEqual(s.thresholds, [rule.holdThresholdM])
  })
}

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
