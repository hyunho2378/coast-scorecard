// 재현 기준 분석. 현황판 사업지(반암, 가진, 아네호)의 가로선 파일을 만든 계산을 브라우저에서 그대로 다시 돌린다.
// 같은 장면(규칙 파일 scene_rule), 같은 분석 창(UTM 상자), 같은 가로선(사업지 transects.geojson)을 쓰고
// 해안선은 가로선을 바다 끝에서 따라가며 NDWI 가 임계값 아래로 내려가 30 m 이상 이어지는 첫 지점으로 잡는다.
// 임계값은 장면마다 기준 해안선(네 장면 NDWI 중앙값 영상) 앞뒤 250 m 띠 안 픽셀의 오츠 값(256칸 막대, 칸 가운데 값)이다.
// 교차점 바다 쪽 30 m 지점 둘레 3 x 3 칸에 SCL 3(구름 그림자), 9(구름 높음), 10(권운)이 있으면 그 장면 값은 뺀다
import { toUtm, fromUtm } from './utm.js'
import { round1 } from '../lib/judge.js'

export const REPRO_SET = {
  res: 10, needM: 30, step: 0.1, bandHalfM: 250, bandStep: 0.5, sclBad: [3, 9, 10], sclBackM: 30, bins: 256, scale: 1e-4
}
export const REPRO_STAGES = ['장면 불러오기', '장면 읽기', '물가선 추출', '가로선 계산']
export const ITEM_URL = 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/'

// NDWI. 반사율은 DN x 0.0001(현황판 계산과 같음), 분모에 1e-9
export function ndwiDn(g, n) {
  const out = new Float64Array(g.length)
  for (let i = 0; i < g.length; i += 1) {
    const a = g[i] * 1e-4
    const b = n[i] * 1e-4
    out[i] = (a - b) / (a + b + 1e-9)
  }
  return out
}

// 픽셀마다 장면 값 중앙값
export function medianStack(arrs) {
  const n = arrs[0].length
  const out = new Float64Array(n)
  const k = arrs.length
  const buf = new Float64Array(k)
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < k; j += 1) buf[j] = arrs[j][i]
    buf.sort()
    out[i] = k % 2 ? buf[(k - 1) / 2] : (buf[k / 2 - 1] + buf[k / 2]) / 2
  }
  return out
}

// 오츠 임계값. -1에서 1을 256칸으로 나눈 막대에서 집단 간 분산이 가장 큰 칸의 가운데 값. mask 가 있으면 참인 픽셀만
export function otsuCenter(values, mask = null, bins = 256) {
  const edges = new Float64Array(bins + 1)
  const stepE = 2 / bins
  for (let k = 0; k <= bins; k += 1) edges[k] = -1 + k * stepE
  edges[bins] = 1
  const hist = new Float64Array(bins)
  for (let i = 0; i < values.length; i += 1) {
    if (mask && !mask[i]) continue
    const v = values[i]
    if (!Number.isFinite(v) || v < -1 || v > 1) continue
    let k = Math.floor((v + 1) * (bins / 2))
    if (k >= bins) k = bins - 1
    if (k > 0 && v < edges[k]) k -= 1
    else if (k < bins - 1 && v >= edges[k + 1]) k += 1
    hist[k] += 1
  }
  const c = new Float64Array(bins)
  for (let k = 0; k < bins; k += 1) c[k] = (edges[k] + edges[k + 1]) / 2
  const w0 = new Float64Array(bins)
  const m0 = new Float64Array(bins)
  let a = 0
  let b = 0
  for (let k = 0; k < bins; k += 1) { a += hist[k]; b += hist[k] * c[k]; w0[k] = a; m0[k] = b }
  const total = w0[bins - 1]
  if (!total) return null
  const mt = m0[bins - 1]
  let best = -Infinity
  let bestK = -1
  for (let k = 0; k < bins; k += 1) {
    const w1 = total - w0[k]
    const bv = (mt * w0[k] / total - m0[k]) ** 2 / (w0[k] * w1)
    if (Number.isNaN(bv)) continue
    if (bv > best) { best = bv; bestK = k }
  }
  return bestK < 0 ? null : c[bestK]
}

// 쌍선형 보간. 좌표는 픽셀 가장자리 기준(열, 행), 칸 가운데는 0.5
export function bilinear(a, w, h, x, y) {
  x -= 0.5
  y -= 0.5
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const dx = x - x0
  const dy = y - y0
  if (!(x0 >= 0 && x0 < w - 1 && y0 >= 0 && y0 < h - 1)) return NaN
  return a[y0 * w + x0] * (1 - dx) * (1 - dy) + a[y0 * w + x0 + 1] * dx * (1 - dy) + a[(y0 + 1) * w + x0] * (1 - dx) * dy + a[(y0 + 1) * w + x0 + 1] * dx * dy
}

// 가로선을 바다 끝(start)에서 방향 d 로 따라가며 물에서 땅으로 넘어가는 첫 지점까지 거리(m). 넘어간 뒤 needM 이상 땅이어야 한다
export function shoreDist(arr, w, h, thr, start, d, L, set = REPRO_SET) {
  const { step, needM, res } = set
  const n = Math.ceil(L / step)
  const vals = new Float64Array(n)
  for (let i = 0; i < n; i += 1) { const t = i * step; vals[i] = bilinear(arr, w, h, start[0] + d[0] * t, start[1] + d[1] * t) }
  const need = Math.trunc(needM / res / step)
  for (let i = 1; i < n - need; i += 1) {
    if (vals[i - 1] >= thr && vals[i] < thr) {
      let ok = true
      for (let j = i; j < i + need; j += 1) if (!(vals[j] < thr)) { ok = false; break }
      if (ok) {
        const fr = (vals[i - 1] - thr) / (vals[i - 1] - vals[i])
        return ((i - 1) * step + fr * step) * res
      }
    }
  }
  return NaN
}

// 경위도 가로선(바다 끝에서 시작)을 분석 창 픽셀 좌표로 바꾼다
export function transectsToPixels(features, cfg) {
  const [E0, N1] = cfg.aoi
  const res = REPRO_SET.res
  const L = (2 * cfg.halfM) / res
  return features.map((f) => {
    const c = f.geometry.coordinates
    const a = toUtm(c[0][0], c[0][1], cfg.zone, cfg.south)
    const b = toUtm(c[c.length - 1][0], c[c.length - 1][1], cfg.zone, cfg.south)
    const s = [(a.x - E0) / res, (N1 - a.y) / res]
    const e = [(b.x - E0) / res, (N1 - b.y) / res]
    const len = Math.hypot(e[0] - s[0], e[1] - s[1])
    return { id: f.properties.id, start: s, d: [(e[0] - s[0]) / len, (e[1] - s[1]) / len], L, geometry: f.geometry }
  })
}

// 장면 NDWI 와 SCL(10 m 로 늘린 값)로 가로선별 장면 거리를 잰다
// scenes: [{ id, period, ndwi, scl }], 모두 w x h 행 우선 배열
export function reproMeasure(scenes, trs, w, h, set = REPRO_SET) {
  const res = set.res
  const med = medianStack(scenes.map((s) => s.ndwi))
  const thrMed = otsuCenter(med, null, set.bins)
  const refD = trs.map((t) => shoreDist(med, w, h, thrMed, t.start, t.d, t.L, set))
  const band = new Uint8Array(w * h)
  const bh = set.bandHalfM / res
  trs.forEach((t, k) => {
    const rd = refD[k]
    if (!Number.isFinite(rd)) return
    const lo = Math.max(rd / res - bh, 0)
    const hi = Math.min(rd / res + bh, t.L)
    const n = Math.ceil((hi - lo) / set.bandStep)
    for (let i = 0; i < n; i += 1) {
      const u = lo + i * set.bandStep
      const qx = t.start[0] + t.d[0] * u
      const qy = t.start[1] + t.d[1] * u
      if (qx >= 0 && qx < w && qy >= 0 && qy < h) band[Math.trunc(qy) * w + Math.trunc(qx)] = 1
    }
  })
  const bad = new Set(set.sclBad)
  const back = set.sclBackM / res
  const out = scenes.map((s) => {
    const thr = otsuCenter(s.ndwi, band, set.bins)
    const dist = trs.map((t) => {
      let v = shoreDist(s.ndwi, w, h, thr, t.start, t.d, t.L, set)
      if (Number.isFinite(v) && s.scl) {
        const u = v / res - back
        const y = Math.trunc(t.start[1] + t.d[1] * u)
        const x = Math.trunc(t.start[0] + t.d[0] * u)
        for (let yy = Math.max(y - 1, 0); yy < Math.min(y + 2, h); yy += 1) {
          for (let xx = Math.max(x - 1, 0); xx < Math.min(x + 2, w); xx += 1) if (bad.has(s.scl[yy * w + xx])) v = NaN
        }
      }
      return v
    })
    return { id: s.id, period: s.period, thr, dist }
  })
  return { thrMed, refD, scenes: out }
}

// 가로선별 장면 거리로 사업지 자료 행을 만든다. 거리는 바다 끝 기준이라 사업 전 평균 - 사업 후 평균이 양수면 바다 쪽 전진
export function reproRows(trs, measured, periodKeys) {
  const [pb, pa] = periodKeys
  return trs.map((t, k) => {
    const dist = {}
    const by = {}
    for (const s of measured.scenes) {
      const v = s.dist[k]
      dist[s.id] = Number.isFinite(v) ? round1(v) : null
      ;(by[s.period] = by[s.period] || []).push(v)
    }
    const mean = (xs) => { const f = (xs || []).filter(Number.isFinite); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : NaN }
    const mb = mean(by[pb])
    const ma = mean(by[pa])
    const ch = mb - ma
    const samepair = {}
    for (const p of periodKeys) {
      const v = by[p] || []
      samepair[p] = v.length === 2 && v.every(Number.isFinite) ? round1(Math.abs(v[0] - v[1])) : null
    }
    return {
      id: t.id, change: Number.isFinite(ch) ? round1(ch) : null, threshold: null, hold: undefined, dist, samepair, start: 'sea',
      before: Number.isFinite(mb) ? round1(mb) : null, after: Number.isFinite(ma) ? round1(ma) : null,
      verdict: Number.isFinite(ch) ? 'hold' : 'nodata', geometry: t.geometry
    }
  })
}

// 장면 해안선(가로선 교차점을 이은 선, 값이 없는 가로선에서 끊음)
export function reproLines(trs, dist, cfg) {
  const [E0, N1] = cfg.aoi
  const res = REPRO_SET.res
  const segs = []
  let cur = []
  trs.forEach((t, k) => {
    const v = dist[k]
    if (Number.isFinite(v)) {
      const u = v / res
      const x = E0 + (t.start[0] + t.d[0] * u) * res
      const y = N1 - (t.start[1] + t.d[1] * u) * res
      const g = fromUtm(x, y, cfg.zone, cfg.south)
      cur.push([Math.round(g.lon * 1e7) / 1e7, Math.round(g.lat * 1e7) / 1e7])
    } else if (cur.length) { segs.push(cur); cur = [] }
  })
  if (cur.length) segs.push(cur)
  return segs.filter((s) => s.length > 1)
}

// 0.5 는 짝수 쪽으로 반올림(현황판 계산과 같음). 20 m SCL 창 시작 행이 2324.5 처럼 떨어질 때 한 칸 어긋나지 않게 한다
export function roundHalfEven(v) {
  const f = Math.floor(v)
  const r = v - f
  if (r > 0.5) return f + 1
  if (r < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

// 영상 창 읽기. 분석 창 좌상단(E0, N1)에서 W x H m. 해상도는 파일 값(10 m 또는 20 m)
async function readWindow(openTiff, href, aoi) {
  const tiff = await openTiff(href)
  const image = await tiff.getImage(0)
  const [ox, oy] = image.getOrigin()
  const [rx] = image.getResolution()
  const [E0, N1, W, H] = aoi
  const x0 = roundHalfEven((E0 - ox) / rx)
  const y0 = roundHalfEven((oy - N1) / rx)
  const w = roundHalfEven(W / rx)
  const h = roundHalfEven(H / rx)
  const [raw] = await image.readRasters({ window: [x0, y0, x0 + w, y0 + h], samples: [0], interleave: false, fillValue: 0 })
  return { raw, w, h }
}

// 20 m SCL 을 10 m 칸으로 늘린다(한 칸을 2 x 2 로)
export function upsample2(raw, w, h, W, H) {
  const out = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const sy = Math.min(h - 1, y >> 1)
    const sx = Math.min(w - 1, x >> 1)
    out[y * W + x] = raw[sy * w + sx]
  }
  return out
}

// 장면 불러오기와 창 읽기. 돌려주는 raw 값(green, nir, scl)은 시험 자료로 그대로 저장할 수 있다
export async function loadReproScenes(cfg, { openTiff, fetchFn = fetch, onProgress = () => {}, signal } = {}) {
  const step = (i, done, total) => onProgress({ stage: i, name: REPRO_STAGES[i], done, total })
  const periodKeys = Object.keys(cfg.periods)
  const ids = periodKeys.flatMap((p) => cfg.periods[p].map((id) => ({ id, period: p })))
  step(0, 0, ids.length)
  const items = []
  for (const [i, s] of ids.entries()) {
    const res = await fetchFn(ITEM_URL + s.id, { signal })
    if (!res.ok) throw Object.assign(new Error(`장면 ${s.id} 응답 ${res.status}`), { kind: 'network' })
    items.push({ ...s, item: await res.json() })
    step(0, i + 1, ids.length)
  }
  const scenes = []
  step(1, 0, items.length)
  for (const [i, s] of items.entries()) {
    if (signal?.aborted) throw Object.assign(new Error('중단'), { name: 'AbortError' })
    const a = s.item.assets
    const [g, n, c] = await Promise.all([readWindow(openTiff, a.green.href, cfg.aoi), readWindow(openTiff, a.nir.href, cfg.aoi), readWindow(openTiff, a.scl.href, cfg.aoi)])
    scenes.push({ id: s.id, period: s.period, date: String(s.item.properties.datetime).slice(0, 10), cloud: s.item.properties['eo:cloud_cover'], green: g.raw, nir: n.raw, scl: c.raw, sclW: c.w, sclH: c.h, visual: a.visual?.href })
    step(1, i + 1, items.length)
  }
  return scenes
}

// 읽은 장면으로 가로선 계산. 네트워크를 쓰지 않아 node 시험이 같은 함수를 돌린다
export function reproFromScenes(cfg, raw, { onProgress = () => {} } = {}) {
  const step = (i, done, total) => onProgress({ stage: i, name: REPRO_STAGES[i], done, total })
  const periodKeys = Object.keys(cfg.periods)
  const W = Math.round(cfg.aoi[2] / REPRO_SET.res)
  const H = Math.round(cfg.aoi[3] / REPRO_SET.res)
  step(2, 0, 1)
  const scenes = raw.map((s) => ({ ...s, ndwi: ndwiDn(s.green, s.nir), scl: upsample2(s.scl, s.sclW, s.sclH, W, H) }))
  const trs = transectsToPixels(cfg.features, cfg)
  const measured = reproMeasure(scenes, trs, W, H)
  step(2, 1, 1)
  const base = reproRows(trs, measured, periodKeys)
  step(3, trs.length, trs.length)
  const outScenes = measured.scenes.map((m, i) => {
    const lines = reproLines(trs, m.dist, cfg)
    const s = scenes[i]
    return {
      id: m.id, date: s.date, period: m.period, cloud: s.cloud, tideCorrected: false, threshold: Math.round(m.thr * 1000) / 1000,
      geometryType: lines.length > 1 ? 'MultiLineString' : 'LineString', segments: lines.length, lines,
      feature: { type: 'Feature', properties: { scene: m.id, date: s.date }, geometry: lines.length > 1 ? { type: 'MultiLineString', coordinates: lines } : lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : null }
    }
  })
  return { base, scenes: outScenes, periods: cfg.periods, measured, items: scenes.map((s) => ({ id: s.id, date: s.date, visual: s.visual })) }
}

// cfg: { aoi, zone, south, halfM, periods({ 시점: [장면 id] }), features(사업지 가로선) }
export async function runRepro(cfg, opts = {}) {
  const started = Date.now()
  const raw = await loadReproScenes(cfg, opts)
  const out = reproFromScenes(cfg, raw, opts)
  return { ...out, seconds: Math.round((Date.now() - started) / 100) / 10 }
}

// 현황판 가로선 파일 값과 견준다. 가로선별 이동 거리 차이(m)와 장면 거리 최대 차이
export function compareWithBoard(base, boardFeatures) {
  const byId = new Map(boardFeatures.map((f) => [Number(f.properties.id), f.properties]))
  return base.map((r) => {
    const p = byId.get(Number(r.id)) || {}
    const board = typeof p.change_m === 'number' ? p.change_m : null
    let sceneMax = 0
    for (const [id, v] of Object.entries(r.dist)) {
      const b = p.dist_m?.[id]
      if (typeof v === 'number' && typeof b === 'number') sceneMax = Math.max(sceneMax, Math.abs(v - b))
      else if ((v === null) !== (b === null || b === undefined)) sceneMax = Infinity
    }
    const diff = board === null && r.change === null ? 0 : board === null || r.change === null ? null : round1(r.change - board)
    return { id: r.id, board, engine: r.change, diff, sceneMax: Number.isFinite(sceneMax) ? round1(sceneMax) : null }
  })
}
