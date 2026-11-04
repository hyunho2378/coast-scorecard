import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verdictOf, summarize, sceneChanges, stormOrder, median } from '../src/lib/judge.js'

test('파일의 hold 가 참이면 값이 커도 판정 보류', () => {
  assert.equal(verdictOf(50, 10, true), 'hold')
})
test('hold 가 거짓이면 부호로 전진과 후퇴', () => {
  assert.equal(verdictOf(12.3, 26.4, false), 'advance')
  assert.equal(verdictOf(-30, 26.4, false), 'retreat')
})
test('hold 속성이 없으면 사업지 기준과 비교', () => {
  assert.equal(verdictOf(9.9, 10, undefined), 'hold')
  assert.equal(verdictOf(-13.5, 13.4, undefined), 'retreat')
})
test('기준도 hold 도 없으면 보류(앱 고정값 없음)', () => {
  assert.equal(verdictOf(100, null, undefined), 'hold')
})
test('값이 없으면 nodata', () => {
  assert.equal(verdictOf(null, 10, true), 'nodata')
})
test('요약: 기준 초과과 보류 개수, 비율, 중앙값', () => {
  const rows = [
    { id: 1, change: 20, verdict: 'advance', threshold: 10 },
    { id: 2, change: -40, verdict: 'retreat', threshold: 10 },
    { id: 3, change: 2, verdict: 'hold', threshold: 10 },
    { id: 4, change: null, verdict: 'nodata', threshold: 10 }
  ]
  const s = summarize(rows)
  assert.equal(s.judgeable, 2); assert.equal(s.held, 2); assert.equal(s.nodata, 1)
  assert.equal(s.heldRatio, 0.5); assert.equal(s.medianChange, -10)
  assert.deepEqual(s.thresholds, [10])
})
test('중앙값 짝수와 홀수', () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([1, 2, 3, 4]), 2.5); assert.equal(median([]), null)
})
test('장면 비교: 거리 값이 없으면 nodata', () => {
  const r = sceneChanges([{ id: 1, threshold: 10, dist: { a: 100, b: 85 } }, { id: 2, threshold: 10, dist: { a: null, b: 3 } }], 'a', 'b')
  assert.equal(r[0].change, 15); assert.equal(r[0].verdict, 'advance'); assert.equal(r[1].verdict, 'nodata')
})
test('점검 목록: 기준 초과만, 변화 큰 순서', () => {
  const list = stormOrder([
    { id: 'a', name: 'A', rows: [{ id: 1, change: 12, verdict: 'advance' }, { id: 2, change: 90, verdict: 'hold' }] },
    { id: 'b', name: 'B', rows: [{ id: 1, change: -50, verdict: 'retreat' }] }
  ])
  assert.deepEqual(list.map((x) => `${x.siteId}${x.id}`), ['b1', 'a1'])
})

test('서류 세 등급 이름: 변화 확인 구간, 정규 측량 일정 구간, 구조물 의심 구간', async () => {
  const { TIER, tierOf, BASES } = await import('../src/lib/judge.js')
  assert.deepEqual(TIER, { exceed: '변화 확인 구간', hold: '정규 측량 일정 구간', struct: '구조물 의심 구간' })
  assert.deepEqual(['advance', 'retreat', 'hold', 'nodata', 'few', 'struct'].map(tierOf), ['exceed', 'exceed', 'hold', 'hold', 'hold', 'struct'])
  assert.deepEqual(BASES, [['sd1', '기본'], ['p95', '엄격']])
})

test('서류 등급 이름: 보류 판정 이름은 정규 측량 일정', async () => {
  const { VERDICT, TIER } = await import('../src/lib/judge.js')
  for (const k of ['hold', 'nodata', 'few']) assert.equal(VERDICT[k].label, '정규 측량 일정')
  assert.deepEqual(TIER, { exceed: '변화 확인 구간', hold: '정규 측량 일정 구간', struct: '구조물 의심 구간' })
})
test('판정 대상 수(targetN): 구조물 의심과 값 없음, 장면 모자란 가로선(보류 판정 포함)을 뺀다', async () => {
  const { applySceneRule, summarize } = await import('../src/lib/judge.js')
  const periods = { 2017: ['a', 'b'], 2025: ['c', 'd'] }
  const full = { a: 1, b: 1, c: 1, d: 1 }
  const rows = applySceneRule([
    { id: 1, change: 30, verdict: 'advance', dist: full },
    { id: 2, change: 5, verdict: 'hold', dist: { ...full, b: null } },
    { id: 3, change: 40, verdict: 'advance', dist: { ...full, d: null } },
    { id: 4, change: null, verdict: 'nodata', dist: {} },
    { id: 5, change: 50, verdict: 'struct', dist: full }
  ], periods)
  assert.deepEqual(rows.map((r) => [r.verdict, Boolean(r.sceneShort)]), [['advance', false], ['hold', true], ['few', true], ['nodata', true], ['struct', false]])
  const s = summarize(rows)
  assert.deepEqual([s.targetN, s.sectionN, s.judgeable, s.held, s.excluded], [1, 3, 1, 3, 1])
})
