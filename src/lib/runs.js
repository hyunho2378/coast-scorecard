// 새 분석 결과를 사업지 자료 형식으로 바꾼다. 결과는 화면 안 메모리와 내려받기 파일로만 둔다
import { periodOf } from './loader-core.js'
import { judgeRows, summarize } from './judge.js'

export const RUN_FILE_KIND = 'coast-scorecard-run'

// result: runAnalysis 결과, korea: 한국 사업지 보류 기준(규칙 파일 site_rules.banam)
export function runToSite(result, { id, name, korea }) {
  const p = result.params
  const site = {
    id, name, region: `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`, country: '새 분석', lat: p.lat, lon: p.lon, zoom: 14.8,
    kind: `${p.beforeYear}년과 ${p.afterYear}년 ${result.meta.season}`, run: true
  }
  const rule = {
    role: 'project',
    holdThresholdM: korea?.holdThresholdM ?? 22.9,
    p95: { threshold_m: korea?.p95?.threshold_m ?? 44.9 },
    structureExcluded: result.structureIds || [],
    nTransects: result.base.length
  }
  const rows = judgeRows(result.base, rule, result.periods)
  const data = {
    status: 'ready', scenes: result.scenes, base: result.base, rows, summary: summarize(rows), period: periodOf(result.scenes),
    before: result.images?.before?.url || null, after: result.images?.after?.url || null, run: { params: p, meta: result.meta }
  }
  return { site, data, rule, periods: result.periods }
}

// 내려받기 파일(JSON). 영상 그림 주소는 이 브라우저 안에서만 열리므로 넣지 않는다
export function runFile(run) {
  const { site, data, rule, periods } = run
  return JSON.stringify({ kind: RUN_FILE_KIND, version: 1, site, rule, periods, data: { scenes: data.scenes, base: data.base, run: data.run } })
}

export function parseRunFile(text) {
  const j = JSON.parse(text)
  if (j?.kind !== RUN_FILE_KIND || !j.site || !Array.isArray(j.data?.base)) throw new Error('분석 결과 파일 형식 아님')
  const rows = judgeRows(j.data.base, j.rule, j.periods)
  return {
    site: j.site, rule: j.rule, periods: j.periods,
    data: { status: 'ready', scenes: j.data.scenes, base: j.data.base, rows, summary: summarize(rows), period: periodOf(j.data.scenes), before: null, after: null, run: j.data.run }
  }
}

// 규칙 파일에 새 분석 사업지 기준을 덧붙인다
export function mergeRules(rules, runs) {
  if (!rules) return rules
  const site_rules = { ...(rules.site_rules || {}) }
  const sites = { ...(rules.scene_rule?.sites || {}) }
  for (const r of runs) {
    site_rules[r.site.id] = r.rule
    sites[r.site.id] = { periods: r.periods }
  }
  return { ...rules, site_rules, scene_rule: { ...(rules.scene_rule || {}), sites } }
}
