// 현장 측량 구간 CSV. 순서는 구조물 의심, 기준 초과, 판정 보류이고 같은 묶음 안에서는 이동 거리 절댓값이 큰 가로선이 앞선다
import { VERDICT, isJudgeable } from './judge.js'

export const SURVEY_GROUP = { struct: '구조물 의심 가로선', exceed: '기준 초과', hold: '판정 보류' }
const RANK = { struct: 0, exceed: 1, hold: 2 }

export function groupOf(verdict) {
  if (verdict === 'struct') return 'struct'
  return isJudgeable(verdict) ? 'exceed' : 'hold'
}

export function surveyRows(rows) {
  const size = (r) => (typeof r.change === 'number' ? Math.abs(r.change) : -1)
  return (rows || [])
    .map((r) => ({ ...r, group: groupOf(r.verdict) }))
    .sort((a, b) => RANK[a.group] - RANK[b.group] || size(b) - size(a) || String(a.id).localeCompare(String(b.id), 'ko', { numeric: true }))
    .map((r, i) => ({ ...r, priority: i + 1 }))
}

const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const num = (v) => (typeof v === 'number' ? v.toFixed(1) : '')

export const SURVEY_HEAD = ['우선순위', '사업지', '가로선', '판정', '방향', '이동 거리(m)', '판정 보류 기준(m)', '보류 기준', '판정 내용']

// 엑셀이 한글 열을 UTF-8로 읽도록 맨 앞에 BOM을 붙이고 줄 끝은 CRLF로 쓴다
export function surveyCsv({ site, rows, basisLabel }) {
  const lines = surveyRows(rows).map((r) => [
    r.priority, site.name, r.id, SURVEY_GROUP[r.group],
    r.verdict === 'advance' ? '전진' : r.verdict === 'retreat' ? '후퇴' : '',
    num(r.change), num(r.threshold), basisLabel, VERDICT[r.verdict]?.note || ''
  ].map(cell).join(','))
  return '\uFEFF' + [SURVEY_HEAD.join(','), ...lines].join('\r\n') + '\r\n'
}

export function surveyFileName(site, today) {
  return `${site.id}_현장측량구간_${today}.csv`
}

// 브라우저 내려받기. 파일은 Blob 주소로만 만들고 저장소에는 아무것도 남기지 않는다
export function downloadText(text, name, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
