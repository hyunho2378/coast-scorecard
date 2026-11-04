// 사후관리대장에 옮겨 적을 문구. 기준 초과 가로선만 넣고 판정 보류 가로선은 넣지 않는다
import { isJudgeable, VERDICT, summarize } from './judge.js'

export function fmtDate(d) {
  if (!d) return ''
  const [y, m, dd] = String(d).slice(0, 10).split('-')
  return `${y}. ${Number(m)}. ${Number(dd)}.`
}

const signed = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} m`

// expected: 같은 기준에서 오차만으로 나올 수 있는 기대 수({ value, label }). 값이 없으면 그 줄을 넣지 않는다
export function ledgerText({ site, rows, period, today, expected }) {
  const ok = rows.filter((r) => isJudgeable(r.verdict))
  if (!ok.length) return ''
  const head = `${fmtDate(today)} 위성 해안선 비교(Sentinel-2, ${fmtDate(period.from)}부터 ${fmtDate(period.to)}까지) 결과`
  const s = summarize(rows)
  const exp = expected && typeof expected.value === 'number'
    ? [`기준 초과 ${ok.length}개, 같은 기준에서 오차만으로 나올 수 있는 기대 수 ${expected.value.toFixed(1)}개(${expected.label})`]
    : []
  const mean = `${site.name} 구간 평균 해빈폭 ${signed(s.sectionMean)} 변화(값이 있는 가로선 ${s.sectionN}개 평균, 판정 보류 포함${s.excluded ? `, 구조물 의심 ${s.excluded}개 제외` : ''}).`
  const lines = ok.map((r) => `${site.name} 가로선 ${r.id}번 해빈폭 ${signed(r.change)} 변화(판정 보류 기준 ${r.threshold} m), 기준 초과 ${VERDICT[r.verdict].label}.`)
  return [head, ...exp, mean, ...lines].join('\n')
}
