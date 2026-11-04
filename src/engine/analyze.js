// 새 사업지 분석. 장면 검색, 장면 읽기, 물가선 추출, 가로선 계산 네 단계를 차례로 돌려 판정 카드와 같은 형식의 자료를 만든다.
// 영상 읽기(openTiff)와 그림 만들기(makeImage)는 밖에서 넣는다. node 시험은 가짜 함수를 넣어 같은 흐름을 돌린다
import { groupCandidates, searchScenes, SEASONS } from './stac.js'
import { extractShoreline, lineLength } from './shoreline.js'
import { generateTransects, measureTransects } from './transects.js'
import { fromUtm, toUtm, zoneFromEpsg } from './utm.js'
import { round1 } from '../lib/judge.js'

export const STAGES = ['장면 검색', '장면 읽기', '물가선 추출', '가로선 계산']
export const FAIL = {
  noscene: '장면 없음',
  cloud: '구름',
  network: '네트워크',
  shore: '물가선 없음'
}
const fail = (kind, detail) => Object.assign(new Error(`${FAIL[kind]}${detail ? `: ${detail}` : ''}`), { kind, detail })
const CLOUD_CLASSES = new Set([3, 8, 9, 10])

// 창 범위(UTM 상자)를 영상 픽셀 창으로 바꾼다
function pixelWindow(image, box) {
  const [ox, oy] = image.getOrigin()
  const [rx, ry] = image.getResolution()
  const x0 = Math.round((box.xmin - ox) / rx)
  const x1 = Math.round((box.xmax - ox) / rx)
  const y0 = Math.round((box.ymax - oy) / ry)
  const y1 = Math.round((box.ymin - oy) / ry)
  return { window: [x0, y0, x1, y1], ox: ox + x0 * rx, oy: oy + y0 * ry, rx, ry, w: x1 - x0, h: y1 - y0 }
}

async function readBand(openTiff, asset, box) {
  const tiff = await openTiff(asset.href)
  const image = await tiff.getImage(0)
  const pw = pixelWindow(image, box)
  const [raw] = await image.readRasters({ window: pw.window, samples: [0], interleave: false, fillValue: asset.nodata ?? 0 })
  const out = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw[i] === (asset.nodata ?? 0) ? NaN : raw[i] * asset.scale + asset.offset
  return { data: out, raw, ...pw }
}

async function readScene(openTiff, scene, box) {
  const [g, n] = await Promise.all([readBand(openTiff, scene.assets.green, box), readBand(openTiff, scene.assets.nir, box)])
  let cloud = 0
  if (scene.assets.scl) {
    try {
      const s = await readBand(openTiff, { ...scene.assets.scl, scale: 1, offset: 0 }, box)
      let k = 0
      for (const v of s.raw) if (CLOUD_CLASSES.has(v)) k += 1
      cloud = s.raw.length ? k / s.raw.length : 0
    } catch { cloud = 0 }
  }
  let valid = 0
  for (const v of g.data) if (Number.isFinite(v)) valid += 1
  return { green: g.data, nir: n.data, w: g.w, h: g.h, ox: g.ox, oy: g.oy, rx: g.rx, ry: g.ry, cloud, validShare: valid / g.data.length }
}

const sceneYear = (s) => Number(s.date.slice(0, 4))

// params: { lon, lat, beforeYear, afterYear, season, spacing, boxM, maxCloud, minScenes, maxScenes, transectLength, structures(경위도 고리 목록) }
export async function runAnalysis(params, { openTiff, makeImage, fetchFn = fetch, onProgress = () => {}, signal } = {}) {
  const p = { spacing: 100, boxM: 2000, maxCloud: 10, minScenes: 2, maxScenes: 3, transectLength: 400, structBuffer: 30, maxSceneCloud: 0.05, level: 'otsu', ...params }
  const started = Date.now()
  const step = (i, done, total) => onProgress({ stage: i, name: STAGES[i], done, total })

  // 1. 장면 검색
  step(0, 0, 2)
  let before
  let after
  try {
    before = await searchScenes({ lon: p.lon, lat: p.lat, year: p.beforeYear, season: p.season, maxCloud: p.maxCloud, fetchFn, signal })
    step(0, 1, 2)
    after = await searchScenes({ lon: p.lon, lat: p.lat, year: p.afterYear, season: p.season, maxCloud: p.maxCloud, fetchFn, signal })
    step(0, 2, 2)
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw fail('network', e.kind ? '' : String(e.message || e))
  }
  if (!before.length || !after.length) throw fail('noscene', `${p.beforeYear}년 ${before.length}장, ${p.afterYear}년 ${after.length}장`)
  const groups = groupCandidates(before, after, p.minScenes)
  if (!groups.length) throw fail('noscene', `같은 타일 ${p.minScenes}장 이상 시점 부족(${p.beforeYear}년 ${before.length}장, ${p.afterYear}년 ${after.length}장)`)

  // 2. 장면 읽기. 묶음마다 구름 적은 장면부터 읽고, 창 안 구름이나 빈 곳이 많은 장면은 건너뛴다
  const zone = zoneFromEpsg(groups[0].before[0].epsg) || { zone: Math.floor((p.lon + 180) / 6) + 1, south: p.lat < 0 }
  const c = toUtm(p.lon, p.lat, zone.zone, zone.south)
  const half = p.boxM / 2
  const box = { xmin: c.x - half, xmax: c.x + half, ymin: c.y - half, ymax: c.y + half }
  let picked = null
  let skipped = 0
  let readCount = 0
  for (const g of groups) {
    const got = { before: [], after: [] }
    const queue = [...g.before.map((s) => ['before', s]), ...g.after.map((s) => ['after', s])]
    const total = Math.min(queue.length, p.maxScenes * 2)
    for (const [key, s] of queue) {
      if (got[key].length >= p.maxScenes) continue
      if (signal?.aborted) throw Object.assign(new Error('중단'), { name: 'AbortError' })
      let r
      try { r = await readScene(openTiff, s, box) } catch (e) { if (e.name === 'AbortError') throw e; throw fail('network', String(e.message || e)) }
      readCount += 1
      step(1, Math.min(readCount, total), total)
      if (r.cloud > p.maxSceneCloud || r.validShare < 0.98) { skipped += 1; continue }
      got[key].push({ ...s, raster: r })
    }
    if (got.before.length >= p.minScenes && got.after.length >= p.minScenes) { picked = { group: g, ...got }; break }
  }
  if (!picked) throw fail('cloud', `창 안 구름이나 빈 곳으로 ${skipped}장 제외`)

  // 3. 물가선 추출
  const all = [...picked.before.map((s) => ({ ...s, period: String(p.beforeYear) })), ...picked.after.map((s) => ({ ...s, period: String(p.afterYear) }))]
  const scenes = []
  all.forEach((s, i) => {
    const r = s.raster
    const ex = extractShoreline(r.green, r.nir, r.w, r.h, { pixel: Math.abs(r.rx), minLen: 300, level: p.level })
    const toMap = (pt) => [r.ox + (pt[0] + 0.5) * r.rx, r.oy + (pt[1] + 0.5) * r.ry]
    const lines = ex.lines.map((l) => l.map(toMap))
    scenes.push({ id: s.id, date: s.date, period: s.period, orbit: s.orbit, cloud: s.cloud, sceneCloud: round1(r.cloud * 100), threshold: ex.threshold, waterShare: ex.waterShare, lines, index: ex.index, r })
    step(2, i + 1, all.length)
  })
  const ref = scenes.find((s) => s.period === String(p.beforeYear) && s.lines.length)
  if (!ref) throw fail('shore', '사업 전 장면')
  const refLine = [...ref.lines].sort((a, b) => lineLength(b) - lineLength(a))[0]

  // 4. 가로선 계산
  const isWater = (x, y) => {
    const col = Math.floor((x - ref.r.ox) / ref.r.rx)
    const row = Math.floor((y - ref.r.oy) / ref.r.ry)
    if (col < 0 || row < 0 || col >= ref.r.w || row >= ref.r.h) return false
    const v = ref.index[row * ref.r.w + col]
    return Number.isFinite(v) && v > ref.threshold
  }
  const transects = generateTransects(refLine, { spacing: p.spacing, length: p.transectLength, isWater })
  step(3, 0, transects.length)
  const rings = (p.structures || []).map((ring) => ring.map(([lon, lat]) => { const u = toUtm(lon, lat, zone.zone, zone.south); return [u.x, u.y] }))
  const measured = measureTransects(transects, scenes, [String(p.beforeYear), String(p.afterYear)], { structures: rings, structBuffer: p.structBuffer })
  step(3, transects.length, transects.length)

  const ll = (pt) => { const g = fromUtm(pt[0], pt[1], zone.zone, zone.south); return [Math.round(g.lon * 1e7) / 1e7, Math.round(g.lat * 1e7) / 1e7] }
  const base = measured.map((m, i) => ({
    id: m.id, change: m.change, threshold: null, hold: undefined, dist: m.dist, samepair: m.samepair, struct: m.struct,
    before: m.before === null ? null : round1(m.before), after: m.after === null ? null : round1(m.after),
    verdict: m.change === null ? 'nodata' : 'hold',
    geometry: { type: 'LineString', coordinates: [ll(transects[i].start), ll(transects[i].end)] }
  }))
  const outScenes = scenes.map((s) => {
    const lines = s.lines.map((l) => l.map(ll))
    return {
      id: s.id, date: s.date, period: s.period, orbit: s.orbit, cloud: s.cloud, sceneCloud: s.sceneCloud, tideCorrected: false,
      threshold: s.threshold === null ? null : Math.round(s.threshold * 1000) / 1000,
      geometryType: lines.length > 1 ? 'MultiLineString' : 'LineString', segments: lines.length, lines,
      feature: { type: 'Feature', properties: { scene: s.id, date: s.date }, geometry: lines.length > 1 ? { type: 'MultiLineString', coordinates: lines } : lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : null }
    }
  })
  const periods = {
    [String(p.beforeYear)]: outScenes.filter((s) => s.period === String(p.beforeYear)).map((s) => s.id),
    [String(p.afterYear)]: outScenes.filter((s) => s.period === String(p.afterYear)).map((s) => s.id)
  }
  let images = { before: null, after: null }
  if (makeImage) {
    images = { before: await makeImage(picked.before[0], box, openTiff).catch(() => null), after: await makeImage(picked.after[0], box, openTiff).catch(() => null) }
  }
  const season = SEASONS.find((x) => x[0] === p.season)?.[1] || ''
  return {
    params: p, zone, box, periods, scenes: outScenes, base, images,
    structureIds: base.filter((r) => r.struct).map((r) => r.id),
    meta: {
      season, orbit: picked.group.sameOrbit ? picked.before[0].orbit : null, tile: picked.before[0].tile,
      candidates: { before: before.length, after: after.length }, skipped, read: readCount,
      seconds: Math.round((Date.now() - started) / 100) / 10
    }
  }
}

export { sceneYear }
