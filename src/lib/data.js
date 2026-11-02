// 사업지 설정과 자료 파일 읽기. 파일 후보를 앞에서부터 읽고 처음 열리는 파일을 쓴다
import { fetchJsonOptional, normalizeShorelines, normalizeTransects, periodOf, samepairFromCorrected } from './loader-core.js'
import { summarize, applySiteRule } from './judge.js'

export const RULES_URL = '/ext/poc2/sensitivity_and_rules.json'

async function firstJson(urls) {
  let last = { status: 'missing' }
  for (const url of urls || []) {
    const r = await fetchJsonOptional(url)
    if (r.status === 'ok') return r
    if (r.status === 'error') last = r
  }
  return last
}

async function firstImage(urls) {
  for (const url of urls || []) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      const type = res.headers.get('content-type') || ''
      if (res.ok && type.startsWith('image/')) return url
    } catch { /* 다음 후보 */ }
  }
  return null
}

export async function loadConfig() {
  const [sites, schedule, omm] = await Promise.all(
    ['/config/sites.json', '/data/acquisition.json', '/data/omm.json'].map((u) => fetch(u).then((r) => {
      if (!r.ok) throw new Error(`${u} 응답 ${r.status}`)
      return r.json()
    }))
  )
  return { sites: sites.sites, schedule, omm }
}

export async function loadRules() {
  return fetchJsonOptional(RULES_URL)
}

// 돌려주는 status: ready(판정 가능), empty(파일 없음), error(읽기 실패)
export async function loadSite(site, rule) {
  const f = site.files || {}
  const [sh, tr, before, after, cor] = await Promise.all([firstJson(f.shorelines), firstJson(f.transects), firstImage(f.before), firstImage(f.after), firstJson(f.corrected)])
  if (sh.status === 'error' || tr.status === 'error') return { status: 'error', message: sh.message || tr.message }
  if (sh.status !== 'ok' || tr.status !== 'ok') return { status: 'empty', before, after }
  const scenes = normalizeShorelines(sh.data)
  let base = normalizeTransects(tr.data)
  if (cor.status === 'ok') base = samepairFromCorrected(base, cor.data)
  const rows = applySiteRule(base, rule)
  return { status: 'ready', scenes, rows, summary: summarize(rows), period: periodOf(scenes), before, after, sources: { shorelines: sh.url, transects: tr.url } }
}
