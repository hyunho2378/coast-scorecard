// Sentinel-2 L2A 장면 검색. Earth Search STAC API(Element 84, 공개, CORS 허용)
export const STAC_URL = 'https://earth-search.aws.element84.com/v1/search'

export const SEASONS = [
  ['spring', '봄', [3, 5]],
  ['summer', '여름', [6, 8]],
  ['autumn', '가을', [9, 11]],
  ['winter', '겨울', [12, 2]]
]

// 계절 기간. 겨울은 전년 12월에서 그해 2월
export function seasonRange(year, season) {
  const s = SEASONS.find((x) => x[0] === season) || SEASONS[0]
  const [m0, m1] = s[2]
  const y0 = m0 > m1 ? year - 1 : year
  const last = new Date(Date.UTC(year, m1, 0)).getUTCDate()
  return [`${y0}-${String(m0).padStart(2, '0')}-01T00:00:00Z`, `${year}-${String(m1).padStart(2, '0')}-${last}T23:59:59Z`]
}

export const orbitOf = (f) => {
  const m = String(f?.properties?.['s2:product_uri'] || '').match(/_R(\d{3})_/)
  return m ? Number(m[1]) : null
}
export const tileOf = (f) => f?.properties?.['grid:code'] || [f?.properties?.['mgrs:utm_zone'], f?.properties?.['mgrs:latitude_band'], f?.properties?.['mgrs:grid_square']].join('')

export async function searchScenes({ lon, lat, year, season, maxCloud = 10, fetchFn = fetch, signal }) {
  const [from, to] = seasonRange(year, season)
  const body = {
    collections: ['sentinel-2-l2a'],
    intersects: { type: 'Point', coordinates: [lon, lat] },
    datetime: `${from}/${to}`,
    query: { 'eo:cloud_cover': { lt: maxCloud } },
    limit: 100
  }
  const res = await fetchFn(STAC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!res.ok) throw Object.assign(new Error(`장면 검색 응답 ${res.status}`), { kind: 'network' })
  const fc = await res.json()
  // 같은 날 같은 타일의 재처리 중복(_0_, _1_)은 하나만 둔다
  const seen = new Map()
  for (const f of fc.features || []) {
    const k = `${tileOf(f)}:${String(f.properties.datetime).slice(0, 10)}:${f.properties.platform}`
    const prev = seen.get(k)
    if (!prev || String(f.id) > String(prev.id)) seen.set(k, f)
  }
  return [...seen.values()].map((f) => ({
    id: f.id, date: String(f.properties.datetime).slice(0, 10), datetime: f.properties.datetime,
    cloud: f.properties['eo:cloud_cover'], orbit: orbitOf(f), tile: tileOf(f), epsg: f.properties['proj:epsg'],
    assets: {
      green: assetOf(f, 'green'), nir: assetOf(f, 'nir'), scl: assetOf(f, 'scl'), visual: assetOf(f, 'visual')
    }
  })).sort((a, b) => a.cloud - b.cloud)
}

// 처리 기준 04.00 이후 장면의 BOA 오프셋(-0.1)은 Earth Search 가 이미 적용한 장면(earthsearch:boa_offset_applied)에서는 다시 빼지 않는다
export function assetOf(f, key) {
  const a = f.assets?.[key]
  if (!a) return null
  const band = a['raster:bands']?.[0] || {}
  const applied = f.properties?.['earthsearch:boa_offset_applied'] === true
  const offset = applied ? 0 : (typeof band.offset === 'number' ? band.offset : 0)
  return { href: a.href, scale: typeof band.scale === 'number' ? band.scale : 1, offset, nodata: band.nodata ?? 0 }
}

// 두 시점 장면 후보를 같은 타일과 같은 상대궤도 묶음으로 나누고, 두 시점 모두 장면이 가장 많은 묶음부터 차례로 돌려준다.
// 같은 상대궤도 묶음이 모자라면 같은 타일 전체 묶음을 뒤에 붙인다
export function groupCandidates(before, after, minScenes = 2) {
  const keys = new Set([...before, ...after].map((s) => `${s.tile}|${s.orbit}`))
  const groups = []
  for (const k of keys) {
    const b = before.filter((s) => `${s.tile}|${s.orbit}` === k)
    const a = after.filter((s) => `${s.tile}|${s.orbit}` === k)
    groups.push({ key: k, sameOrbit: true, before: b, after: a, score: Math.min(b.length, a.length) })
  }
  for (const tile of new Set([...before, ...after].map((s) => s.tile))) {
    const b = before.filter((s) => s.tile === tile)
    const a = after.filter((s) => s.tile === tile)
    groups.push({ key: `${tile}|all`, sameOrbit: false, before: b, after: a, score: Math.min(b.length, a.length) })
  }
  return groups.filter((g) => g.before.length >= minScenes && g.after.length >= minScenes)
    .sort((x, y) => Number(y.sameOrbit) - Number(x.sameOrbit) || y.score - x.score || (x.before[0].cloud + x.after[0].cloud) - (y.before[0].cloud + y.after[0].cloud))
}
