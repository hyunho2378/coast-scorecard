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
  assert.match(t, /가로선 3번 해빈폭 \+21\.4 m 변화\(판정 보류 기준 13\.4 m\), 기준 초과 전진\./)
  assert.match(t, /가로선 6번 해빈폭 -18\.0 m 변화\(판정 보류 기준 13\.4 m\), 기준 초과 후퇴\./)
  assert.doesNotMatch(t, /판정 (전진|후퇴|가능)/)
  assert.doesNotMatch(t, /기대 수/)
  assert.match(t, /가로선 6번 해빈폭 -18\.0 m/)
  assert.doesNotMatch(t, /가로선 4번/); assert.doesNotMatch(t, /가로선 5번/)
  assert.match(t, /고성 반암 구간 평균 해빈폭 \+2\.8 m 변화\(값이 있는 가로선 3개 평균, 판정 보류 포함\)\./)
  assert.match(t, /^2026\. 11\. 3\. 위성 해안선 비교\(Sentinel-2, 2017\. 4\. 13\.부터 2025\. 5\. 30\.까지\) 결과/)
})
test('기준 초과 가로선이 없으면 빈 문구', () => {
  assert.equal(ledgerText({ ...base, rows: [{ id: 1, change: 2, threshold: 10, verdict: 'hold' }] }), '')
})
test('문구에 가운뎃점과 줄표가 없다', () => {
  const t = ledgerText({ ...base, rows: [{ id: 1, change: 30, threshold: 10, verdict: 'advance' }] })
  assert.doesNotMatch(t, /[·—–]/)
})
test('기대 수 줄: 첫 줄 아래에 기준 초과 개수와 오차만으로 나올 수 있는 기대 수', () => {
  const rows = [{ id: 26, change: 41.2, threshold: 22.9, verdict: 'advance' }, { id: 27, change: 40.3, threshold: 22.9, verdict: 'advance' }, { id: 1, change: 3, threshold: 22.9, verdict: 'hold' }]
  const t = ledgerText({ ...base, rows, expected: { value: 6.3, label: '1표준편차' } }).split('\n')
  assert.equal(t[1], '기준 초과 2개, 같은 기준에서 오차만으로 나올 수 있는 기대 수 6.3개(1표준편차)')
  assert.match(t[2], /구간 평균 해빈폭/)
  const t95 = ledgerText({ ...base, rows, expected: { value: 1, label: '95%' } }).split('\n')
  assert.equal(t95[1], '기준 초과 2개, 같은 기준에서 오차만으로 나올 수 있는 기대 수 1.0개(95%)')
  assert.doesNotMatch(ledgerText({ ...base, rows, expected: { value: null, label: '1표준편차' } }), /기대 수/)
})
