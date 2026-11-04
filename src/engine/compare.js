// 미리 계산한 사업지 가로선(경위도) 위에서 새로 추출한 물가선의 이동 거리를 잰다. 두 결과를 가로선별로 견줄 때 쓴다
import { crossingDist } from './transects.js'
import { toUtm } from './utm.js'
import { median, round1 } from '../lib/judge.js'

// features: transects.geojson 의 가로선, scenes: [{ id, period, lines(경위도) }], periodKeys: [사업 전, 사업 후]
// 가로선 시작점이 바다 쪽(start 'sea')이면 거리가 줄어들 때 전진이다
export function measureOnTransects(features, scenes, periodKeys, zone) {
  const u = (pt) => { const r = toUtm(pt[0], pt[1], zone.zone, zone.south); return [r.x, r.y] }
  const sl = scenes.map((s) => ({ ...s, utm: s.lines.map((l) => l.map(u)) }))
  return features.map((f) => {
    const c = f.geometry.coordinates
    const start = u(c[0])
    const end = u(c[c.length - 1])
    const L = Math.hypot(end[0] - start[0], end[1] - start[1])
    const known = Object.values(f.properties.dist_m || {}).filter((v) => typeof v === 'number')
    const tr = { start, end, refDist: known.length ? median(known) : L / 2 }
    const by = {}
    const dist = {}
    for (const s of sl) {
      const d = crossingDist(tr, s.utm)
      dist[s.id] = d === null ? null : round1(d)
      if (d !== null) (by[s.period] = by[s.period] || []).push(d)
    }
    const [pb, pa] = periodKeys
    const mb = by[pb]?.length ? median(by[pb]) : null
    const ma = by[pa]?.length ? median(by[pa]) : null
    const sign = f.properties.start === 'sea' ? -1 : 1
    return { id: f.properties.id, change: mb !== null && ma !== null ? round1(sign * (ma - mb)) : null, n: [by[pb]?.length || 0, by[pa]?.length || 0], dist }
  })
}
