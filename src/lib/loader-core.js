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

// 가로선 정리. 판정은 파일의 change_m, hold, hold_threshold_m 를 그대로 쓴다
export function normalizeTransects(fc) {
  return (fc?.features || []).map((f) => {
    const p = f.properties || {}
    const change = typeof p.change_m === 'number' ? round1(p.change_m) : null
    const threshold = typeof p.hold_threshold_m === 'number' ? p.hold_threshold_m : null
    return {
      id: p.id, change, threshold,
      hold: typeof p.hold === 'boolean' ? p.hold : undefined,
      tideCorrected: p.tide_corrected === true,
      dist: p.dist_m || null,
      verdict: verdictOf(change, threshold, typeof p.hold === 'boolean' ? p.hold : undefined),
      geometry: f.geometry
    }
  })
}

// 조위 표시: 가로선 값 기준. 모두 보정이면 보정, 모두 미보정이면 미보정, 섞이면 일부 보정
export function tideLabel(rows) {
  if (!rows.length) return '조위 미보정'
  const n = rows.filter((r) => r.tideCorrected).length
  if (n === rows.length) return '조위 보정'
  if (n === 0) return '조위 미보정'
  return `조위 일부 보정(${n}/${rows.length})`
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
