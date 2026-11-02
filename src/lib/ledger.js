// 사후관리대장에 옮겨 적을 문구. 판정 가능 가로선만 넣고 판정 보류 가로선은 넣지 않는다
import { isJudgeable, VERDICT } from './judge.js'

export function fmtDate(d) {
  if (!d) return ''
  const [y, m, dd] = String(d).slice(0, 10).split('-')
  return `${y}. ${Number(m)}. ${Number(dd)}.`
}

const signed = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} m`

export function ledgerText({ site, rows, period, today }) {
  const ok = rows.filter((r) => isJudgeable(r.verdict))
  if (!ok.length) return ''
  const head = `${fmtDate(today)} 위성 해안선 비교(Sentinel-2, ${fmtDate(period.from)}부터 ${fmtDate(period.to)}까지) 결과`
  const lines = ok.map((r) => `${site.name} 가로선 ${r.id}번 해빈폭 ${signed(r.change)} 변화(판정 보류 기준 ${r.threshold} m), 판정 ${VERDICT[r.verdict].label}.`)
  return [head, ...lines].join('\n')
}
