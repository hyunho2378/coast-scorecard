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
// 등급 경계 폭은 사업 전 해빈폭 20 m 가정의 해빈폭 점수 경계 폭(m)과 등급 변경 확률
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

export function typeRulesFor(rules, keys) {
  const t = rules?.type_rules
  if (!t) return []
  return (keys || []).map((k) => t[k]).filter(Boolean).map((x) => ({ label: x.label, text: x.app_wording || x.text }))
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
