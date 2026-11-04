// 사후관리대장에 옮겨 적을 문구. 변화 확인 가로선만 넣고 정규 측량 일정 가로선은 넣지 않는다
import { isJudgeable, VERDICT, summarize } from './judge.js'

export function fmtDate(d) {
  if (!d) return ''
  const [y, m, dd] = String(d).slice(0, 10).split('-')
  return `${y}. ${Number(m)}. ${Number(dd)}.`
}

const signed = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} m`

// 둘째 줄은 사실 숫자만 쓴다: 변화 확인 개수(보류 기준, 판정 대상 가로선 수), 정규 측량 일정 개수, 구조물 의심 개수
// 판정 대상 수는 summarize 의 targetN(구조물 의심 제외, 값 있음, 두 시점 장면 최소 장수 이상)
export function ledgerText({ site, rows, period, today }) {
  const ok = rows.filter((r) => isJudgeable(r.verdict))
  if (!ok.length) return ''
  const head = `${fmtDate(today)} 위성 해안선 비교(Sentinel-2, ${fmtDate(period.from)}부터 ${fmtDate(period.to)}까지) 결과`
  const s = summarize(rows)
  const thr = [...new Set(rows.map((r) => r.threshold).filter((v) => typeof v === 'number'))]
  const basis = thr.length === 1 ? `보류 기준 ${thr[0]} m 초과, ` : ''
  const counts = `변화 확인 ${ok.length}개(${basis}판정 대상 ${s.targetN}개 중), 정규 측량 일정 ${s.held}개, 구조물 의심 ${s.excluded}개`
  const mean = `${site.name} 구간 평균 해빈폭 ${signed(s.sectionMean)} 변화(값이 있는 가로선 ${s.sectionN}개 평균, 정규 측량 일정 포함${s.excluded ? `, 구조물 의심 ${s.excluded}개 제외` : ''}).`
  const lines = ok.map((r) => `${site.name} 가로선 ${r.id}번 해빈폭 ${signed(r.change)} 변화(보류 기준 ${r.threshold} m), 변화 확인 ${VERDICT[r.verdict].label}.`)
  return [head, counts, mean, ...lines].join('\n')
}
