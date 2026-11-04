// 문서 센터 내려받기 파일. 모두 문자열로 만들고 브라우저에서 Blob 으로 내려받는다(저장소 쓰지 않음)
import { VERDICT, isJudgeable } from './judge.js'

const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const num = (v) => (typeof v === 'number' ? v.toFixed(1) : '')
export const csv = (head, rows) => '\uFEFF' + [head.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n'

// 판정 열 값은 서류의 세 등급 이름(변화 확인, 정규 측량 일정, 구조물 의심)에 원래 판정을 괄호로 붙인다
export const verdictText = (v) => (v === 'struct' ? '구조물 의심' : isJudgeable(v) ? `변화 확인(${VERDICT[v].label})` : '정규 측량 일정')

export function transectsGeojson(site, rows) {
  return JSON.stringify({
    type: 'FeatureCollection',
    name: `${site.id}_가로선`,
    features: (rows || []).filter((r) => r.geometry).map((r) => ({
      type: 'Feature',
      properties: { site: site.name, id: r.id, change_m: r.change, threshold_m: r.threshold, verdict: verdictText(r.verdict), note: VERDICT[r.verdict]?.note || '' },
      geometry: r.geometry
    }))
  })
}

export function shorelinesGeojson(site, scenes) {
  return JSON.stringify({
    type: 'FeatureCollection',
    name: `${site.id}_해안선`,
    features: (scenes || []).filter((s) => s.feature?.geometry).map((s) => ({
      type: 'Feature', properties: { site: site.name, scene: s.id, date: s.date }, geometry: s.feature.geometry
    }))
  })
}

export const APPENDIX_HEAD = ['사업지', '가로선', '이동 거리(m)', '보류 기준(m)', '판정', '판정 내용']
// list: [{ site, data }] 판정까지 끝난 사업지
export function appendixRows(list) {
  const out = []
  for (const { site, data } of list) {
    if (data?.status !== 'ready') continue
    for (const r of data.rows) out.push([site.name, r.id, num(r.change), num(r.threshold), verdictText(r.verdict), VERDICT[r.verdict]?.note || ''])
  }
  return out
}
export const appendixCsv = (list) => csv(APPENDIX_HEAD, appendixRows(list))

export const stamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
