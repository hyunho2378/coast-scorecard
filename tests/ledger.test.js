import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ledgerText, fmtDate } from '../src/lib/ledger.js'

const base = { site: { name: '고성 반암' }, period: { from: '2017-04-13', to: '2025-05-30' }, today: '2026-11-03' }

test('날짜 표기', () => { assert.equal(fmtDate('2017-04-13'), '2017. 4. 13.') })
test('기준 초과 가로선만 넣고 보류는 뺀다', () => {
  const t = ledgerText({ ...base, rows: [
    { id: 3, change: 21.4, threshold: 13.4, verdict: 'advance' },
    { id: 4, change: 5, threshold: 13.4, verdict: 'hold' },
    { id: 5, change: null, threshold: 13.4, verdict: 'nodata' },
    { id: 6, change: -18, threshold: 13.4, verdict: 'retreat' }
  ] })
  assert.match(t, /가로선 3번 해빈폭 \+21\.4 m 변화\(보류 기준 13\.4 m\), 변화 확인 전진\./)
  assert.match(t, /가로선 6번 해빈폭 -18\.0 m 변화\(보류 기준 13\.4 m\), 변화 확인 후퇴\./)
  assert.doesNotMatch(t, /판정 (전진|후퇴|가능)/)
  assert.doesNotMatch(t, /기대 수/)
  assert.match(t, /가로선 6번 해빈폭 -18\.0 m/)
  assert.doesNotMatch(t, /가로선 4번/); assert.doesNotMatch(t, /가로선 5번/)
  assert.match(t, /고성 반암 구간 평균 해빈폭 \+2\.8 m 변화\(값이 있는 가로선 3개 평균, 정규 측량 일정 포함\)\./)
  assert.match(t, /^2026\. 11\. 3\. 위성 해안선 비교\(Sentinel-2, 2017\. 4\. 13\.부터 2025\. 5\. 30\.까지\) 결과/)
})
test('기준 초과 가로선이 없으면 빈 문구', () => {
  assert.equal(ledgerText({ ...base, rows: [{ id: 1, change: 2, threshold: 10, verdict: 'hold' }] }), '')
})
test('문구에 가운뎃점과 줄표가 없다', () => {
  const t = ledgerText({ ...base, rows: [{ id: 1, change: 30, threshold: 10, verdict: 'advance' }] })
  assert.doesNotMatch(t, /[·—–]/)
})
test('개수 줄: 첫 줄 아래에 기준 초과(보류 기준, 판정 대상 수)와 보류, 구조물 의심 개수만', () => {
  const rows = [{ id: 26, change: 41.2, threshold: 22.9, verdict: 'advance' }, { id: 27, change: 40.3, threshold: 22.9, verdict: 'advance' }, { id: 1, change: 3, threshold: 22.9, verdict: 'hold' }, { id: 2, change: 60, threshold: 22.9, verdict: 'struct' }]
  const t = ledgerText({ ...base, rows }).split('\n')
  assert.equal(t[1], '변화 확인 2개(보류 기준 22.9 m 초과, 판정 대상 3개 중), 정규 측량 일정 1개, 구조물 의심 1개')
  assert.match(t[2], /구간 평균 해빈폭/)
  assert.doesNotMatch(t.join('\n'), /기대 수|오차만으로|표준편차|95%/)
})
test('개수 줄: 보류 기준이 가로선마다 다르면 기준 값을 빼고 판정 대상 수만', () => {
  const rows = [{ id: 1, change: 30, threshold: 20, verdict: 'advance' }, { id: 2, change: 3, threshold: 25, verdict: 'hold' }]
  assert.equal(ledgerText({ ...base, rows }).split('\n')[1], '변화 확인 1개(판정 대상 2개 중), 정규 측량 일정 1개, 구조물 의심 0개')
})
