import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromUtm, toUtm, zoneFromEpsg } from '../src/engine/utm.js'
import { chainSegments, contourSegments, extractShoreline, ndwi, otsu, otsu3 } from '../src/engine/shoreline.js'
import { crossingDist, generateTransects, measureTransects, pointPolygonDist, samePairs } from '../src/engine/transects.js'
import { assetOf, groupCandidates, orbitOf, seasonRange } from '../src/engine/stac.js'
import { runAnalysis } from '../src/engine/analyze.js'
import { measureOnTransects } from '../src/engine/compare.js'

test('UTM 변환: 반암 좌표가 52구역이고 왕복 오차가 1e-7도 이하', () => {
  const u = toUtm(128.4637, 38.4236)
  assert.equal(u.zone, 52)
  assert.ok(u.x > 452000 && u.x < 454500, String(u.x))
  assert.ok(u.y > 4200000 && u.y < 4300000, String(u.y))
  const g = fromUtm(u.x, u.y, 52)
  assert.ok(Math.abs(g.lon - 128.4637) < 1e-7 && Math.abs(g.lat - 38.4236) < 1e-7)
  // 경도 1/1000도(약 87 m) 차이가 UTM 에서 80 m 에서 95 m
  const v = toUtm(128.4647, 38.4236, 52)
  assert.ok(v.x - u.x > 80 && v.x - u.x < 95)
  assert.deepEqual(zoneFromEpsg(32652), { zone: 52, south: false })
  assert.deepEqual(zoneFromEpsg(32731), { zone: 31, south: true })
})

test('NDWI 와 오츠: 두 집단 경계가 두 값 사이, 3집단 위 경계는 모래와 물 사이', () => {
  const g = Float32Array.from([0.05, 0.05, 0.3])
  const n = Float32Array.from([0.3, 0.05, 0.05])
  const v = ndwi(g, n)
  assert.ok(v[0] < 0 && Math.abs(v[1]) < 1e-6 && v[2] > 0)
  const two = Float32Array.from([...Array(500).fill(-0.5), ...Array(500).fill(0.5)])
  const t = otsu(two)
  assert.ok(t > -0.5 && t < 0.5)
  const three = Float32Array.from([...Array(400).fill(-0.6), ...Array(200).fill(-0.15), ...Array(600).fill(0.4)])
  const [lo, hi] = otsu3(three)
  assert.ok(lo > -0.6 && lo < -0.15, String(lo))
  assert.ok(hi > -0.15 && hi < 0.4, String(hi))
})

test('marching squares: 세로 경계 격자에서 등치선이 경계 열을 따라 한 줄로 이어진다', () => {
  const w = 10, h = 8
  const grid = new Float32Array(w * h)
  for (let r = 0; r < h; r += 1) for (let c = 0; c < w; c += 1) grid[r * w + c] = c >= 5 ? 1 : -1
  const segs = contourSegments(grid, w, h, 0)
  const lines = chainSegments(segs)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].length, h)
  for (const [x] of lines[0]) assert.ok(Math.abs(x - 4.5) < 1e-9)
})

// 바다가 동쪽(열이 큰 쪽)인 가짜 장면. 물가선 열 위치 edge(픽셀)
function scene(w, h, edge) {
  const green = new Float32Array(w * h)
  const nir = new Float32Array(w * h)
  for (let r = 0; r < h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      const i = r * w + c
      if (c >= edge) { green[i] = 0.06; nir[i] = 0.02 } else if (c >= edge - 3) { green[i] = 0.2; nir[i] = 0.25 } else { green[i] = 0.05; nir[i] = 0.35 }
    }
  }
  return { green, nir }
}

test('물가선 추출: 경계 열에서 반 픽셀 안쪽으로 선이 잡힌다', () => {
  const { green, nir } = scene(60, 60, 30)
  const ex = extractShoreline(green, nir, 60, 60, { pixel: 10, minLen: 300 })
  assert.equal(ex.lines.length, 1)
  for (const [x] of ex.lines[0]) assert.ok(x > 28.5 && x < 30.5, String(x))
})

test('가로선: 직선 해안선 1 km 에 100 m 간격, 바다 쪽 끝이 동쪽', () => {
  const line = [[0, 0], [0, 1000]]
  const tr = generateTransects(line, { spacing: 100, length: 400, isWater: (x) => x > 0 })
  assert.equal(tr.length, 10)
  for (const t of tr) {
    assert.ok(t.end[0] > t.start[0])
    assert.ok(Math.abs(Math.hypot(t.end[0] - t.start[0], t.end[1] - t.start[1]) - 400) < 1e-6)
  }
  assert.ok(Math.abs(tr[1].s - tr[0].s - 100) < 1e-9)
})

test('가로선 이동 거리: 사업 후 해안선이 바다 쪽 30 m 면 +30, 장면쌍 차이와 구조물 의심', () => {
  const tr = generateTransects([[0, 0], [0, 1000]], { spacing: 100, length: 400, isWater: (x) => x > 0 })
  const L = (x) => [[[x, -100], [x, 1100]]]
  const scenes = [
    { id: 'a1', period: '2017', lines: L(0) }, { id: 'a2', period: '2017', lines: L(4) },
    { id: 'b1', period: '2025', lines: L(30) }, { id: 'b2', period: '2025', lines: L(34) }
  ]
  const ring = [[20, 450], [60, 450], [60, 560], [20, 560], [20, 450]]
  const rows = measureTransects(tr, scenes, ['2017', '2025'], { structures: [ring], structBuffer: 30 })
  for (const r of rows) assert.equal(r.change, 30)
  assert.deepEqual(Object.values(rows[0].samepair), [4, 4])
  const hit = rows.filter((r) => r.struct).map((r) => r.id)
  assert.ok(hit.includes(5) && hit.includes(6) && !hit.includes(1), JSON.stringify(hit))
  assert.equal(pointPolygonDist([40, 500], ring), 0)
  assert.equal(pointPolygonDist([0, 500], ring), 20)
  assert.deepEqual(samePairs({ x: [1, 4, 6] }), { p0: 3, p1: 5, p2: 2 })
  assert.equal(crossingDist({ start: [-200, 0], end: [200, 0], refDist: 200 }, [[[10, -5], [10, 5]], [[150, -5], [150, 5]]]), 210)
})

test('장면 고르기: 계절 기간, 상대궤도, 같은 궤도 묶음 우선, BOA 오프셋 처리', () => {
  assert.deepEqual(seasonRange(2025, 'winter'), ['2024-12-01T00:00:00Z', '2025-02-28T23:59:59Z'])
  assert.deepEqual(seasonRange(2017, 'spring'), ['2017-03-01T00:00:00Z', '2017-05-31T23:59:59Z'])
  assert.equal(orbitOf({ properties: { 's2:product_uri': 'S2A_MSIL2A_20250530T021121_N0511_R103_T52SDH_20250530T062212.SAFE' } }), 103)
  const mk = (id, orbit, cloud) => ({ id, orbit, cloud, tile: 'T', assets: {} })
  const g = groupCandidates([mk('a', 3, 1), mk('b', 3, 2), mk('c', 103, 0)], [mk('d', 3, 1), mk('e', 3, 0), mk('f', 103, 0), mk('h', 103, 1)], 2)
  assert.equal(g[0].key, 'T|3')
  assert.equal(g[0].sameOrbit, true)
  const f = (applied) => ({ properties: { 'earthsearch:boa_offset_applied': applied }, assets: { green: { href: 'x', 'raster:bands': [{ scale: 0.0001, offset: -0.1, nodata: 0 }] } } })
  assert.equal(assetOf(f(true), 'green').offset, 0)
  assert.equal(assetOf(f(false), 'green').offset, -0.1)
})

// runAnalysis 전체 흐름: 가짜 STAC 응답과 가짜 영상(원점과 해상도, 창 읽기)
function fakeEnv(edges) {
  const origin = toUtm(128.4637, 38.4236, 52)
  const ox = Math.round(origin.x) - 1500
  const oy = Math.round(origin.y) + 1500
  const W = 300
  const feats = Object.keys(edges).map((id) => ({
    id, properties: { datetime: `${id.slice(0, 4)}-04-${id.slice(5)}T02:00:00Z`, 'eo:cloud_cover': 1, 'grid:code': 'MGRS-52SDH', 'proj:epsg': 32652, platform: 'p', 's2:product_uri': 'X_R003_Y' },
    assets: { green: { href: `${id}/g` }, nir: { href: `${id}/n` } }
  }))
  const fetchFn = async (url, opt) => {
    const body = JSON.parse(opt.body)
    const y = body.datetime.slice(0, 4)
    return { ok: true, json: async () => ({ features: feats.filter((f) => f.id.startsWith(y)) }) }
  }
  const openTiff = async (href) => {
    const [id, band] = href.split('/')
    const s = scene(W, W, edges[id])
    return {
      getImage: async () => ({
        getOrigin: () => [ox, oy], getResolution: () => [10, -10],
        readRasters: async ({ window: [x0, y0, x1, y1] }) => {
          const w = x1 - x0, h = y1 - y0
          const out = new Uint16Array(w * h)
          const src = band === 'g' ? s.green : s.nir
          for (let r = 0; r < h; r += 1) for (let c = 0; c < w; c += 1) out[r * w + c] = Math.round(src[(r + y0) * W + (c + x0)] * 10000)
          return [out]
        }
      })
    }
  }
  return { fetchFn, openTiff }
}

test('새 분석 흐름: 사업 후 물가선이 3픽셀(30 m) 바다 쪽이면 가로선 이동 거리가 +30 m 안팎', async () => {
  const { fetchFn, openTiff } = fakeEnv({ '2017-01': 150, '2017-11': 150, '2025-01': 153, '2025-11': 153 })
  const stages = []
  const out = await runAnalysis({ lon: 128.4637, lat: 38.4236, beforeYear: 2017, afterYear: 2025, season: 'spring' }, { fetchFn, openTiff, onProgress: (e) => stages.push(e.name) })
  assert.deepEqual([...new Set(stages)], ['장면 검색', '장면 읽기', '물가선 추출', '가로선 계산'])
  assert.ok(out.base.length >= 15, String(out.base.length))
  const ch = out.base.map((r) => r.change).filter((v) => typeof v === 'number')
  const mid = ch.sort((a, b) => a - b)[Math.floor(ch.length / 2)]
  assert.ok(Math.abs(mid - 30) <= 2, String(mid))
  assert.deepEqual(Object.keys(out.periods), ['2017', '2025'])
  assert.equal(out.periods['2017'].length, 2)
  // 같은 결과를 원래 가로선(경위도) 위에서 재도 +30 m 안팎
  const feats = out.base.slice(0, 3).map((r) => ({ properties: { id: r.id, start: 'land', dist_m: {} }, geometry: r.geometry }))
  const cmp = measureOnTransects(feats, out.scenes, ['2017', '2025'], out.zone)
  for (const c of cmp) assert.ok(Math.abs(c.change - 30) <= 2, String(c.change))
})

test('새 분석 실패 원인: 장면 없음', async () => {
  const fetchFn = async () => ({ ok: true, json: async () => ({ features: [] }) })
  await assert.rejects(runAnalysis({ lon: 128, lat: 38, beforeYear: 2017, afterYear: 2025, season: 'spring' }, { fetchFn, openTiff: async () => null }), (e) => e.kind === 'noscene')
  const bad = async () => ({ ok: false, status: 503 })
  await assert.rejects(runAnalysis({ lon: 128, lat: 38, beforeYear: 2017, afterYear: 2025, season: 'spring' }, { fetchFn: bad, openTiff: async () => null }), (e) => e.kind === 'network')
})
