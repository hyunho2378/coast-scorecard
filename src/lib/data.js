// 사업지 설정과 자료 파일 읽기. 파일 후보를 앞에서부터 읽고 처음 열리는 파일을 쓴다
import { fetchJsonOptional, normalizeShorelines, normalizeTransects, periodOf, samepairFromCorrected } from './loader-core.js'
import { summarize, judgeRows } from './judge.js'

// 모든 자료 주소는 앱 기본 주소(vite base, 배포 '/coast-scorecard/')를 앞에 붙인 상대 경로로 읽는다
export const BASE = import.meta.env?.BASE_URL || '/'
export const asset = (p) => (/^(https?:)?\/\//.test(p) ? p : BASE + String(p).replace(/^\.?\//, ''))
export const RULES_URL = asset('data/sensitivity_and_rules_v3.json')

async function firstJson(urls) {
  let last = { status: 'missing' }
  for (const url of urls || []) {
    const r = await fetchJsonOptional(asset(url))
    if (r.status === 'ok') return r
    if (r.status === 'error') last = r
  }
  return last
}

async function firstImage(urls) {
  for (const url of urls || []) {
    try {
      const res = await fetch(asset(url), { method: 'HEAD', cache: 'no-store' })
      const type = res.headers.get('content-type') || ''
      if (res.ok && type.startsWith('image/')) return asset(url)
    } catch { /* 다음 후보 */ }
  }
  return null
}

export async function loadConfig() {
  const [sites, omm] = await Promise.all(
    ['config/sites.json', 'data/omm.json'].map((u) => fetch(asset(u)).then((r) => {
      if (!r.ok) throw new Error(`${u} 응답 ${r.status}`)
      return r.json()
    }))
  )
  return { sites: sites.sites, omm }
}

export async function loadRules() {
  return fetchJsonOptional(RULES_URL)
}

// 돌려주는 status: ready(읽기 완료), empty(파일 없음), error(읽기 실패)
// rules 는 규칙 파일 전체. 사업지 보류 기준(site_rules)과 장면 규칙(scene_rule)을 차례로 적용한다
export async function loadSite(site, rules) {
  const rule = rules?.site_rules?.[site.id]
  const periods = rules?.scene_rule?.sites?.[site.id]?.periods
  const f = site.files || {}
  const [sh, tr, before, after, cor] = await Promise.all([firstJson(f.shorelines), firstJson(f.transects), firstImage(f.before), firstImage(f.after), firstJson(f.corrected)])
  if (sh.status === 'error' || tr.status === 'error') return { status: 'error', message: sh.message || tr.message }
  if (sh.status !== 'ok' || tr.status !== 'ok') return { status: 'empty', before, after }
  const scenes = normalizeShorelines(sh.data)
  let base = normalizeTransects(tr.data)
  if (cor.status === 'ok') base = samepairFromCorrected(base, cor.data)
  const rows = judgeRows(base, rule, periods)
  return { status: 'ready', scenes, base, rows, summary: summarize(rows), period: periodOf(scenes), before, after, sources: { shorelines: sh.url, transects: tr.url } }
}

// 보류 기준을 바꾸면 읽어 둔 가로선(base)에 판정을 다시 적용한다
export function withBasis(d, site, rules, basis, min = 2) {
  if (d?.status !== 'ready' || !d.base) return d
  const rows = judgeRows(d.base, rules?.site_rules?.[site.id], rules?.scene_rule?.sites?.[site.id]?.periods, basis, min)
  return { ...d, rows, summary: summarize(rows), basis }
}
