// 가로선 생성과 이동 거리 계산. 좌표는 UTM 미터 평면 좌표([x, y])
import { median, round1 } from '../lib/judge.js'

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const len = (v) => Math.hypot(v[0], v[1])

// 선 위 거리 s(m)의 점과 그 점의 진행 방향(단위 벡터)
export function pointAt(line, s) {
  let acc = 0
  for (let i = 1; i < line.length; i += 1) {
    const d = len(sub(line[i], line[i - 1]))
    if (acc + d >= s || i === line.length - 1) {
      const t = d ? Math.min(1, Math.max(0, (s - acc) / d)) : 0
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]
    }
    acc += d
  }
  return line[line.length - 1]
}
export function polyLength(line) {
  let d = 0
  for (let i = 1; i < line.length; i += 1) d += len(sub(line[i], line[i - 1]))
  return d
}

// 기준 해안선을 따라 spacing(m) 간격으로 해안선과 직각인 가로선을 긋는다.
// 진행 방향은 앞뒤 smooth(m) 떨어진 두 점으로 정해 픽셀 계단을 누른다.
// isWater(x, y)로 바다 쪽을 정하고 가로선은 육지 쪽 끝에서 시작해 바다 쪽 끝에서 끝난다(시작점 기준 거리가 커지면 바다 쪽 전진)
export function generateTransects(line, { spacing = 100, length = 400, smooth = 100, margin = 50, isWater } = {}) {
  const total = polyLength(line)
  const out = []
  const half = length / 2
  const probe = Math.min(80, half * 0.6)
  for (let s = margin; s <= total - margin + 1e-6; s += spacing) {
    const p = pointAt(line, s)
    const a = pointAt(line, Math.max(0, s - smooth))
    const b = pointAt(line, Math.min(total, s + smooth))
    const t = sub(b, a)
    const tl = len(t)
    if (!tl) continue
    let n = [-t[1] / tl, t[0] / tl]
    let side = 0
    if (isWater) {
      const plus = isWater(p[0] + n[0] * probe, p[1] + n[1] * probe)
      const minus = isWater(p[0] - n[0] * probe, p[1] - n[1] * probe)
      if (plus && !minus) side = 1
      else if (minus && !plus) side = -1
    }
    out.push({ s, p, n, side })
  }
  // 바다 쪽을 못 정한 가로선은 앞뒤 가로선 다수 방향을 따른다
  const sum = out.reduce((k, o) => k + o.side, 0) || 1
  return out.map((o, i) => {
    const dir = o.side || (Math.sign(sum))
    const n = [o.n[0] * dir, o.n[1] * dir]
    return { id: i + 1, s: o.s, start: [o.p[0] - n[0] * half, o.p[1] - n[1] * half], end: [o.p[0] + n[0] * half, o.p[1] + n[1] * half], refDist: half, sideFixed: o.side !== 0 }
  })
}

// 두 선분 교차. 첫 선분 위 비율 t를 돌려준다
function crossT(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1], qx = d[0] - c[0], qy = d[1] - c[1]
  const den = rx * qy - ry * qx
  if (!den) return null
  const t = ((c[0] - a[0]) * qy - (c[1] - a[1]) * qx) / den
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
}

// 가로선과 한 장면 물가선(여러 선)의 교차 중 refDist 에 가장 가까운 점까지의 거리(m). 교차가 없으면 null
export function crossingDist(tr, lines) {
  const L = len(sub(tr.end, tr.start))
  let best = null
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const t = crossT(tr.start, tr.end, line[i - 1], line[i])
      if (t === null) continue
      const d = t * L
      if (best === null || Math.abs(d - tr.refDist) < Math.abs(best - tr.refDist)) best = d
    }
  }
  return best
}

// 점과 다각형(닫힌 고리, UTM) 거리. 안쪽이면 0
export function pointPolygonDist(p, ring) {
  let inside = false
  let best = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i], b = ring[j]
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
    const ab = sub(b, a)
    const l2 = ab[0] ** 2 + ab[1] ** 2
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2)) : 0
    best = Math.min(best, Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t)))
  }
  return inside ? 0 : best
}

// 같은 해 장면끼리 모든 쌍의 차이(절댓값)
export function samePairs(values) {
  const out = {}
  let k = 0
  for (const xs of Object.values(values)) {
    const v = xs.filter((x) => typeof x === 'number')
    for (let i = 0; i < v.length; i += 1) for (let j = i + 1; j < v.length; j += 1) out[`p${k++}`] = round1(Math.abs(v[i] - v[j]))
  }
  return out
}

// 가로선별 이동 거리. scenes: [{ id, period, lines(UTM) }], periods: [사업 전 시점, 사업 후 시점]
// change = 사업 후 중앙값 - 사업 전 중앙값(양수는 바다 쪽 전진). structures: 다각형 고리(UTM) 목록, structBuffer(m) 이내 교차가 있으면 구조물 의심
export function measureTransects(transects, scenes, periodKeys, { structures = [], structBuffer = 30 } = {}) {
  return transects.map((tr) => {
    const dist = {}
    const by = {}
    const struct = { hit: false }
    const L = len(sub(tr.end, tr.start))
    for (const sc of scenes) {
      const d = crossingDist(tr, sc.lines)
      dist[sc.id] = d === null ? null : round1(d)
      if (d !== null) {
        ;(by[sc.period] = by[sc.period] || []).push(d)
        if (structures.length) {
          const t = d / L
          const p = [tr.start[0] + (tr.end[0] - tr.start[0]) * t, tr.start[1] + (tr.end[1] - tr.start[1]) * t]
          if (structures.some((ring) => pointPolygonDist(p, ring) <= structBuffer)) struct.hit = true
        }
      }
    }
    const [pb, pa] = periodKeys
    const mb = by[pb]?.length ? median(by[pb]) : null
    const ma = by[pa]?.length ? median(by[pa]) : null
    const change = mb !== null && ma !== null ? round1(ma - mb) : null
    return { id: tr.id, change, dist, samepair: samePairs(by), struct: struct.hit, before: mb, after: ma }
  })
}
