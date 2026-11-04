// 자료 정리 함수. 브라우저와 node 시험이 함께 쓰므로 화면 코드와 vite 전용 기능을 넣지 않는다
import { round1, verdictOf } from './judge.js'

// 없는 파일은 missing, 읽기 실패는 error 로 돌려주고 예외를 던지지 않는다
export async function fetchJsonOptional(url, fetchFn = fetch) {
  try {
    const res = await fetchFn(url, { cache: 'no-store' })
    const type = (res.headers?.get?.('content-type')) || ''
    if (res.status === 404 || type.includes('text/html')) return { status: 'missing', url }
    if (!res.ok) return { status: 'error', url, message: `응답 ${res.status}` }
    return { status: 'ok', url, data: await res.json() }
  } catch (e) {
    return { status: 'error', url, message: String(e?.message || e) }
  }
}

// 해안선 장면 정리. 구름으로 끊긴 해안선은 MultiLineString 이며 조각 수를 함께 센다
export function normalizeShorelines(fc) {
  const feats = fc?.features || []
  return feats.map((f) => {
    const g = f.geometry
    let lines = []
    if (g?.type === 'LineString') lines = [g.coordinates]
    else if (g?.type === 'MultiLineString') lines = g.coordinates.filter((l) => Array.isArray(l) && l.length > 1)
    const p = f.properties || {}
    return {
      id: p.scene, date: p.date, tideCorrected: p.tide_corrected === true,
      geometryType: g?.type || null, segments: lines.length, lines,
      feature: { type: 'Feature', properties: { scene: p.scene, date: p.date }, geometry: lines.length > 1 ? { type: 'MultiLineString', coordinates: lines } : lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : null }
    }
  }).filter((s) => s.id)
}

// 같은 해 장면끼리 모든 쌍의 거리 차이. 파일에 samepair_absdiff_m 가 없을 때 쓴다
export function pairsFromDist(dist) {
  if (!dist) return null
  const by = {}
  for (const [scene, v] of Object.entries(dist)) {
    const y = String(scene).match(/_(\d{4})\d{4}/)?.[1]
    if (!y || typeof v !== 'number') continue
    ;(by[y] = by[y] || []).push(v)
  }
  const out = {}
  let n = 0
  for (const xs of Object.values(by)) for (let i = 0; i < xs.length; i += 1) for (let j = i + 1; j < xs.length; j += 1) out[`p${n++}`] = Math.abs(xs[i] - xs[j])
  return out
}

// 가로선 정리. 판정은 파일의 change_m, hold, hold_threshold_m 를 그대로 쓴다
export function normalizeTransects(fc) {
  return (fc?.features || []).map((f) => {
    const p = f.properties || {}
    const change = typeof p.change_m === 'number' ? round1(p.change_m) : null
    const threshold = typeof p.hold_threshold_m === 'number' ? p.hold_threshold_m : null
    return {
      id: p.id, change, threshold,
      hold: typeof p.hold === 'boolean' ? p.hold : undefined,
      dist: p.dist_m || null,
      samepair: p.samepair_absdiff_m || pairsFromDist(p.dist_m),
      jarkusId: p.jarkus_id ?? null,
      start: p.start || null,
      verdict: verdictOf(change, threshold, typeof p.hold === 'boolean' ? p.hold : undefined),
      geometry: f.geometry
    }
  })
}

export function periodOf(scenes) {
  const ds = scenes.map((s) => s.date).filter(Boolean).sort()
  return { from: ds[0] || null, to: ds[ds.length - 1] || null, years: [...new Set(ds.map((d) => d.slice(0, 4)))] }
}

// 민감도와 규칙 파일. 형식이 정해지기 전이라 사업지 항목을 여러 모양에서 찾는다. 찾지 못하면 null
export function rulesForSite(rules, siteId) {
  if (!rules || typeof rules !== 'object') return null
  const pools = [rules.sites, rules.by_site, rules.site_rules, rules]
  for (const pool of pools) {
    if (!pool) continue
    if (Array.isArray(pool)) {
      const hit = pool.find((x) => x && (x.id === siteId || x.site === siteId || x.site_id === siteId))
      if (hit) return hit
    } else if (pool[siteId] && typeof pool[siteId] === 'object') return pool[siteId]
  }
  return null
}

export function bandOf(entry) {
  if (!entry) return null
  for (const k of ['grade_band_m', 'grade_swing_m', 'band_m', 'sensitivity_m', 'grade_shift_width_m']) {
    if (typeof entry[k] === 'number') return { value: entry[k], key: k }
  }
  return null
}

// sensitivity_and_rules.json(poc4) 형식. 측량 대조가 있는 사업지는 두 시점 변화량 오차, 없는 곳은 단일 시점 위치 오차 항목을 쓴다.
// 등급 경계 폭은 사업 전 해빈폭 20 m 가정의 해빈폭 점수 경계 폭(m)과 p_grade_change 값
export function gradeSensitivity(rules, siteId) {
  const list = Array.isArray(rules?.sensitivity) ? rules.sensitivity : null
  if (!list || !list.length) return null
  const site = rules.site_rules?.[siteId] || null
  const entry = (site?.surveyAvailable && list.find((s) => String(s.errorKind || '').includes('변화량'))) || list[0]
  const gc = (entry.gradeChange || []).find((g) => g.W0_m === 20 && typeof g.boundary_band_beachwidth_change_m === 'number')
  const tf = entry.targetFitScore?.[siteId]?.runs?.[0] || null
  if (!gc && !tf) return null
  return {
    errorM: entry.errorM, errorKind: entry.errorKind,
    bandM: gc ? gc.boundary_band_beachwidth_change_m : null,
    pGradeChange: gc ? gc.p_grade_change : null,
    w0: gc ? gc.W0_m : null,
    targetFit: tf ? { score: tf.true_score, p05: tf.p05, p95: tf.p95 } : null
  }
}

// 규칙 파일의 사업지 보류 기준과 가로선 파일 값 비교. 다르면 화면에 함께 보인다
export function holdRuleCheck(rules, siteId, summary) {
  const r = rules?.site_rules?.[siteId]
  if (!r || typeof r.holdThresholdM !== 'number') return null
  const fileT = summary?.thresholds || []
  const same = fileT.length === 1 && Math.abs(fileT[0] - r.holdThresholdM) < 0.05
  return { ruleM: r.holdThresholdM, fileM: fileT, same, ruleJudgeable: r.judgeableCount, basis: r.basis || '' }
}

// 사업 유형별 해석. 규칙 파일 문구(개조식 "~함.")는 그대로 두고 화면에는 앱 문장을 쓴다
export const TYPE_RULE_TEXT = {
  structures: { label: '돌제와 잠제, 이안제', text: '구조물 배후 구간과 표사 하류 인접 구간을 한 단위로 묶어 배후 전진과 하류 후퇴를 나란히 봅니다.' },
  nourishment: { label: '양빈', text: '준공 전 해빈폭 대신 설계 감쇠 예측 대비 남은 비율로 보고 양옆 인접 구간까지 함께 집계합니다.' },
  seasonal: { label: '계절 비교', text: '같은 계절 장면끼리 비교하고 한 해 장면 2장 이상의 중앙값을 씁니다. 여러 해 장면이 있으면 같은 계절 평균으로 사업 전후를 비교합니다.' }
}
export function typeRulesFor(rules, keys) {
  const t = rules?.type_rules
  if (!t) return []
  return (keys || []).filter((k) => t[k]).map((k) => TYPE_RULE_TEXT[k] || { label: t[k].label, text: t[k].app_wording || t[k].text })
}

// 오차 유형별 민감도 한 표(sensitivity_unified). 상하한 적용 전과 후 값을 같은 열 기준으로 함께 돌려준다.
// 반암은 구조물 의심을 뺀 가로선 20개 행, 가진은 전체 행을 쓴다
export const UNIFIED_MODES = [
  ['bias_independent', '치우침, 두 시점 독립'],
  ['mixed_sandmotor', '혼합'],
  ['scatter', '흩어짐'],
  ['bias_same', '치우침, 두 시점 같음']
]
const UNIFIED_SITE = { banam: ['반암 구조물 의심 제외', '반암 전체'], jinjin: ['가진 구조물 의심 제외', '가진 전체'] }
export function unifiedFor(rules, siteId) {
  const u = rules?.sensitivity_unified
  const names = UNIFIED_SITE[siteId]
  if (!u || !Array.isArray(u.rows) || !names) return null
  const excl = (rules.site_rules?.[siteId]?.structureExcluded || []).length > 0
  const name = names.find((n) => (excl || !n.includes('제외')) && u.rows.some((r) => r.site === n))
  if (!name) return null
  const rows = UNIFIED_MODES.map(([mode, label]) => {
    const r = u.rows.find((x) => x.site === name && x.mode === mode)
    if (!r) return null
    const pair = (k) => [r[`${k}_unclipped`], r[`${k}_clipped`]]
    return { mode, label, beachWidth: pair('bw_sd'), fit: pair('fit_sd'), corr: pair('corr'), total: pair('total_sd'), pGrade: pair('p_grade'), noTarget: pair('no_target_sd'), pNoTarget: pair('p_grade_no_target') }
  }).filter(Boolean)
  if (!rows.length) return null
  const first = u.rows.find((x) => x.site === name)
  return {
    site: name, errorM: u.error_m, w0: u.W0_m, offset: u.target_offset_m, runs: u.M,
    nTransects: first.n_transects, meanChange: first.mean_change_m,
    beachWidthTrue: first.bw_true_clipped, fitTrue: first.fit_true_clipped, rows
  }
}

// 사업비와 효과평가 대상 여부(project_facts). 단위 백만 원
export function projectFactsFor(rules, siteId) {
  const f = rules?.project_facts
  if (!f) return null
  const amount = siteId === 'banam' ? f.banam_rows?.[0]?.amount_million : siteId === 'jinjin' ? f.gajin_amount_million : null
  if (typeof amount !== 'number') return null
  return { amountMillion: amount, eok: Math.round(amount / 100), legal: amount >= 20000 }
}
export function nextCandidates(rules) {
  return (rules?.project_facts?.candidates_200 || []).map((c) => ({ no: c.no, name: c.name, eok: Math.round(c.amount_million / 100), construct: c.construct, done: c.done, content: c.content, status: c.status }))
}

// 연도별 장면쌍 90퍼센타일(year_threshold_rule). 반암은 구조물 의심 포함 행과 제외 행을 함께 돌려준다
export function yearThresholdRows(rules) {
  const y = rules?.year_threshold_rule?.sites
  if (!y) return []
  const out = []
  for (const [id, x] of Object.entries(y)) {
    out.push({ id, part: 'all', p2017: x.p90_2017, p2025: x.p90_2025, pooled: x.p90_pooled, maxYear: x.p90_max_year, sd1: x.sd1_maxyear, n: x.n_transects })
    if (x.excl_struct) out.push({ id, part: 'excl', p2017: x.excl_struct.p90_2017, p2025: x.excl_struct.p90_2025, pooled: x.excl_struct.p90_pooled, maxYear: x.excl_struct.p90_max_year, sd1: x.excl_struct.sd1_maxyear, p95: x.excl_struct.p95_maxyear, n: x.n_transects, excluded: x.excl_struct.excluded.length })
  }
  return out
}

// 규칙 파일 false_positive 항목 읽기. 화면에는 쓰지 않는다(시험에서만 읽음)
export function falsePositiveRows(rules) {
  const f = rules?.false_positive
  const b = rules?.site_rules?.banam
  if (!f || !b) return []
  return [
    { basis: 'sd1', label: '기본', thresholdM: b.holdThresholdM, rate: f.analytic_sd1, n: f.banam_pass_sd1, expected: f.banam_expected_false_sd1, judgeable: b.judgeableCount },
    { basis: 'p95', label: '엄격', thresholdM: b.p95?.threshold_m, rate: f.analytic_p95, n: f.banam_pass_p95, expected: f.banam_expected_false_p95, judgeable: b.p95?.judgeable }
  ]
}

// 조위 환산 위치 표(Sand Motor)로 가로선별 같은 계절 장면쌍 차이를 만든다.
// 환산 위치 = 위성 위치 - (평균고조위 - 촬영 시각 수위) / 경사. 같은 해 장면끼리 모든 쌍의 차이
export function samepairFromCorrected(rows, corrected) {
  if (!Array.isArray(corrected) || !corrected.length) return rows
  const pos = {}
  for (const r of corrected) {
    if (r.sat_cs == null || !r.slope) continue
    const v = r.sat_cs - (r.mhw_m_nap - r.wl_m_nap) / r.slope
    const k = String(r.transect)
    pos[k] = pos[k] || {}
    const per = String(r.period || String(r.scene).match(/_(\d{4})\d{4}/)?.[1])
    ;(pos[k][per] = pos[k][per] || []).push(v)
  }
  return rows.map((t) => {
    const by = pos[String(t.jarkusId)]
    if (!by) return { ...t, samepair: {} }
    const out = {}
    let n = 0
    for (const xs of Object.values(by)) {
      for (let i = 0; i < xs.length; i += 1) for (let j = i + 1; j < xs.length; j += 1) out[`p${n++}`] = Math.abs(xs[i] - xs[j])
    }
    return { ...t, samepair: out }
  })
}

// 오차 유형별 민감도(sensitivity, poc5 형식). 해외 사이트 별표 10 입력에만 쓴다. 사이트마다 쓸 오차 크기를 고른다.
// 동해안 사전 오차가 있는 한국 사이트는 16.21 m, 측량 대조가 있는 사이트는 변화량 RMSE, 나머지는 첫 항목의 오차.
// 표 값은 사업 전 해빈폭 50 m, 목표해안선 바다 쪽 10 m 조건의 기본 보류 기준 점수
export const SENS_MODES = [
  ['bias_independent', '치우침'],
  ['mixed_sandmotor', '혼합'],
  ['scatter', '흩어짐']
]
export function errorSizeFor(rules, siteId) {
  const list = Array.isArray(rules?.sensitivity) ? rules.sensitivity : []
  const site = rules?.site_rules?.[siteId] || null
  if (!list.length) return null
  if (site?.surveyAvailable && typeof site.surveyChangeRmseM === 'number') return list.find((e) => e.errorM === site.surveyChangeRmseM) ? site.surveyChangeRmseM : list[0].errorM
  if (typeof site?.priorChangeErrorM === 'number') {
    const pos = Math.round((site.priorChangeErrorM / Math.SQRT2) * 100) / 100
    if (list.some((e) => e.errorM === pos)) return pos
  }
  return list[0].errorM
}
export function sensitivityFor(rules, siteId, w0 = 50, offset = 10) {
  const list = Array.isArray(rules?.sensitivity) ? rules.sensitivity : []
  const errorM = errorSizeFor(rules, siteId)
  if (errorM === null) return null
  const rowsOut = []
  for (const [mode, label] of SENS_MODES) {
    const e = list.find((x) => x.errorM === errorM && x.errorMode === mode)
    const w = e?.bySite?.[siteId]?.W0?.find((x) => x.W0_m === w0)
    const t = w?.withTarget?.find((x) => x.target_offset_m === offset)
    if (!w || !t) continue
    rowsOut.push({ mode, label, beachWidth: w.beachWidth_sd_linear, fit: t.fit_sd, corr: t.corr_beachWidth_fit, total: t.total_sd_joint, pGrade: t.p_grade_change })
  }
  if (!rowsOut.length) return null
  const kind = list.find((x) => x.errorM === errorM)?.errorKind || ''
  return { errorM, errorKind: kind, w0, offset, rows: rowsOut }
}

// 별표 10 점수 표에 쓰는 값. 사이트 오차 크기, 치우침(두 시점 독립) 항목에서 해빈폭별 점수 변동과 목표해안선 위치별 적합도
export function scoreInputsFor(rules, siteId) {
  const list = Array.isArray(rules?.sensitivity) ? rules.sensitivity : []
  const errorM = errorSizeFor(rules, siteId)
  const e = list.find((x) => x.errorM === errorM && x.errorMode === 'bias_independent')
  const by = e?.bySite?.[siteId]
  if (!by) return null
  const w50 = by.W0.find((x) => x.W0_m === 50)
  return {
    errorM, errorKind: e.errorKind,
    beachWidth: by.W0.map((x) => ({ w0: x.W0_m, sd: x.beachWidth_sd_linear })),
    targetFit: (w50?.withTarget || []).map((t) => ({ offset: t.target_offset_m, score: t.fit_true, sd: t.fit_sd }))
  }
}

// 판정 정밀도: 측량 대조가 있는 사업지는 두 시점 변화량 오차, 없는 곳은 단일 시점 위치 오차 첫 항목
export function precisionFor(rules, siteId) {
  const list = Array.isArray(rules?.sensitivity) ? rules.sensitivity : null
  if (!list?.length) return null
  const site = rules.site_rules?.[siteId] || null
  const e = (site?.surveyAvailable && list.find((s) => String(s.errorKind || '').includes('변화량'))) || list[0]
  return {
    errorM: e.errorM, errorKind: e.errorKind,
    beachWidth: (e.beachWidthScore || []).map((b) => ({ w0: b.W0_m, sd: b.score_change_1sigma, p95: b.score_change_95 })),
    targetFit: (e.targetFitScore?.[siteId]?.runs || []).map((r) => ({ offset: r.target_offset_m, score: r.true_score, p05: r.p05, p95: r.p95 }))
  }
}
