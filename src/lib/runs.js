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

// 재현 기준 결과를 사업지 자료 형식으로 바꾼다. 판정 기준과 구조물 의심 가로선은 현황판 사업지 규칙을 그대로 쓴다
// out: runReproInBrowser 결과, base: 현황판 사업지(site), boardRule: 규칙 파일 site_rules[사업지]
// structureIds: 화면에서 불러온 구조물 의심 가로선 번호(재현 기준 기본값은 현황판 규칙의 번호 전체)
export function reproToSite(out, { id, name, base, boardRule, structureIds, images = {} }) {
  const rule = { ...boardRule, structureExcluded: [...(structureIds ?? boardRule?.structureExcluded ?? [])], nTransects: out.base.length }
  const site = {
    id, name, region: base.region, country: '새 분석', lat: base.lat, lon: base.lon, zoom: base.zoom,
    kind: `재현 기준 ${base.name}`, run: true
  }
  const params = { mode: 'repro', siteId: base.id, siteName: base.name, aoi: base.repro.aoi, spacingM: base.repro.spacingM, halfM: base.repro.halfM }
  const meta = { seconds: out.seconds, bytes: out.bytes || 0, requests: out.requests || 0, structures: rule.structureExcluded.length }
  const rows = judgeRows(out.base, rule, out.periods)
  const data = {
    status: 'ready', scenes: out.scenes, base: out.base, rows, summary: summarize(rows), period: periodOf(out.scenes),
    before: images.before || null, after: images.after || null, run: { params, meta }
  }
  return { site, data, rule, periods: out.periods }
}

const dotDate = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return `${y}. ${m}. ${dd}.` }

// 새 분석 재현 조건. 결과 화면 맨 위 한 줄과 CSV 머리말이 함께 쓴다. [이름, 값] 목록
export function runConditions(run) {
  const p = run?.data?.run?.params || {}
  const scenes = [...(run?.data?.scenes || [])].map((s) => s.date).filter(Boolean).sort()
  const thr = run?.rule?.holdThresholdM
  const nStruct = (run?.rule?.structureExcluded || []).length
  const out = []
  if (p.mode === 'repro') {
    out.push(['분석 방식', `재현 기준(${p.siteName} 현황판과 같은 장면, 가로선, 구조물 의심 가로선)`])
    out.push(['장면', scenes.map(dotDate).join(', ')])
    out.push(['구름 기준', '교차점 바다 쪽 30 m 둘레 3 x 3 칸에 구름 그림자와 구름(SCL 3과 9, 10)이 있으면 그 장면 값 제외'])
    out.push(['물가선', '장면별 NDWI 오츠 임계값(기준 해안선 앞뒤 250 m 띠), 바다 끝에서 30 m 이상 이어지는 첫 땅 지점'])
    out.push(['가로선 간격', `${p.spacingM} m, 가로선 ${run.data.base.length}개, 길이 ${p.halfM * 2} m`])
  } else {
    out.push(['분석 방식', '자동 가로선(새 물가선에서 가로선 생성)'])
    out.push(['장면', scenes.map(dotDate).join(', ')])
    out.push(['구름 기준', `장면 구름 ${p.maxCloud ?? 10}% 미만, 분석 창 안 구름 ${Math.round((p.maxSceneCloud ?? 0.05) * 100)}% 이하`])
    out.push(['물가선', 'NDWI 3집단 오츠 임계값 등치선'])
    out.push(['가로선 간격', `${p.spacing} m, 가로선 ${run?.data?.base?.length ?? 0}개, 길이 ${p.transectLength ?? 400} m`])
  }
  out.push(['보류 기준', `${thr} m 이하 이동, 같은 해 장면쌍 차이 ${thr} m 초과, 시점별 장면 2장 미만이면 정규 측량 일정`])
  out.push(['구조물 의심 가로선', nStruct ? `${nStruct}개(${(run.rule.structureExcluded || []).join(', ')}번)` : '없음'])
  return out
}

// CSV 머리말. 줄마다 # 으로 시작하고 이름과 값을 쉼표로 나눈다
export function conditionsCsvHead(conds) {
  const cell = (s) => (/[",\r\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s)
  return conds.map(([k, v]) => `# ${k},${cell(String(v))}`)
}

// 결과 화면 맨 위 한 줄(짧은 값). 자세한 값은 runConditions 와 CSV 머리말
export function runLine(run) {
  const p = run?.data?.run?.params || {}
  const dates = [...(run?.data?.scenes || [])].map((s) => s.date).filter(Boolean).sort().map(dotDate).join(', ')
  return [
    ['방식', p.mode === 'repro' ? `재현 기준(${p.siteName})` : '자동 가로선'],
    ['장면', dates],
    ['구름 기준', p.mode === 'repro' ? 'SCL 3과 9, 10 제외' : `장면 ${p.maxCloud ?? 10}% 미만, 창 안 ${Math.round((p.maxSceneCloud ?? 0.05) * 100)}% 이하`],
    ['가로선 간격', `${p.mode === 'repro' ? p.spacingM : p.spacing} m`],
    ['보류 기준', `${run?.rule?.holdThresholdM} m`]
  ]
}

// 재현 기준 결과와 현황판 가로선 값 대조. 가로선 번호가 같은 행의 이동 거리 차이(소수 첫째 자리) 최대값
// 두 쪽 모두 값이 없으면 차이 0, 한쪽만 값이 없으면 differ 로 센다
export function boardDiff(engineBase, boardBase) {
  if (!Array.isArray(engineBase) || !Array.isArray(boardBase) || !engineBase.length) return null
  const byId = new Map(boardBase.map((r) => [Number(r.id), r]))
  let max = 0
  let differ = 0
  for (const r of engineBase) {
    const b = byId.get(Number(r.id))
    const e = typeof r.change === 'number' ? r.change : null
    const v = b && typeof b.change === 'number' ? b.change : null
    if (e === null && v === null) continue
    if (e === null || v === null) { differ += 1; continue }
    max = Math.max(max, Math.abs(Math.round((e - v) * 10) / 10))
  }
  return { n: engineBase.length, max, differ }
}
export const boardDiffLine = (d) => (d ? `현황판 값과 가로선 ${d.n}개 차이 최대 ${d.max.toFixed(1)} m${d.differ ? `, 값 유무가 다른 가로선 ${d.differ}개` : ''}` : '')
