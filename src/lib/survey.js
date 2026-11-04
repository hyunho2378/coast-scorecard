// 현장 측량 구간 CSV. 순서는 구조물 의심, 변화 확인, 정규 측량 일정이고 같은 묶음 안에서는 이동 거리 절댓값이 큰 가로선이 앞선다
import { VERDICT, isJudgeable } from './judge.js'

// 판정 열 값은 서류의 세 등급 이름
export const SURVEY_GROUP = { struct: '구조물 의심', exceed: '변화 확인', hold: '정규 측량 일정' }
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

export const SURVEY_HEAD = ['우선순위', '사업지', '가로선', '판정', '방향', '이동 거리(m)', '보류 기준(m)', '위도', '경도', '판정 내용']

// 가로선의 해안 쪽 기준 점. 기준 장면 해안선(shoreline 의 선분 좌표)과 가로선 선분이 만나는 점을 쓰고
// 만나는 점이 여럿이면 가로선 시작점에서 기준 장면 거리(dist_m)에 가장 가까운 점, 없으면 가로선 선분의 중간점
const linesOf = (g) => (g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? g.coordinates : [])
function cross(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1], qx = d[0] - c[0], qy = d[1] - c[1]
  const den = rx * qy - ry * qx
  if (!den) return null
  const t = ((c[0] - a[0]) * qy - (c[1] - a[1]) * qx) / den
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
}
const meters = (a, b) => {
  const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180)
  return Math.hypot((b[0] - a[0]) * 111320 * k, (b[1] - a[1]) * 110950)
}
export function basePoint(transect, shoreline, baseDist) {
  const line = linesOf(transect)[0]
  if (!line || line.length < 2) return null
  const a = line[0], b = line[line.length - 1]
  const hits = []
  for (const sl of linesOf(shoreline)) {
    for (let i = 0; i < sl.length - 1; i += 1) {
      const t = cross(a, b, sl[i], sl[i + 1])
      if (t !== null) hits.push(t)
    }
  }
  const len = meters(a, b)
  const pick = hits.length
    ? hits.sort((x, y) => (typeof baseDist === 'number' ? Math.abs(x * len - baseDist) - Math.abs(y * len - baseDist) : x - y))[0]
    : 0.5
  return { lon: a[0] + (b[0] - a[0]) * pick, lat: a[1] + (b[1] - a[1]) * pick, onShore: hits.length > 0 }
}
const deg = (v) => (typeof v === 'number' ? v.toFixed(6) : '')

// 엑셀이 한글 열을 UTF-8로 읽도록 맨 앞에 BOM을 붙이고 줄 끝은 CRLF로 쓴다
// baseScene: 기준 장면({ id, feature }). 가로선 기준 점을 구할 때 쓴다
// head: 표 앞에 붙일 머리말 줄(새 분석 재현 조건, # 으로 시작)
export function surveyCsv({ site, rows, baseScene, head = [] }) {
  const lines = surveyRows(rows).map((r) => {
    const p = basePoint(r.geometry, baseScene?.feature?.geometry, r.dist?.[baseScene?.id])
    return [
      r.priority, site.name, r.id, SURVEY_GROUP[r.group],
      r.verdict === 'advance' ? '전진' : r.verdict === 'retreat' ? '후퇴' : '',
      num(r.change), num(r.threshold), deg(p?.lat), deg(p?.lon), VERDICT[r.verdict]?.note || ''
    ].map(cell).join(',')
  })
  return '\uFEFF' + [...head, SURVEY_HEAD.join(','), ...lines].join('\r\n') + '\r\n'
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
