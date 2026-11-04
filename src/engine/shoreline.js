// 물가선 추출. NDWI = (B03 - B08) / (B03 + B08), 오츠 임계값으로 물과 땅을 가르고
// marching squares 로 임계값 등치선을 그린다. 브라우저와 node 시험이 함께 쓰므로 DOM 을 쓰지 않는다

// green, nir: 반사율 배열(같은 크기), 값이 없으면 NaN
export function ndwi(green, nir) {
  const out = new Float32Array(green.length)
  for (let i = 0; i < green.length; i += 1) {
    const g = green[i]
    const n = nir[i]
    const s = g + n
    out[i] = Number.isFinite(g) && Number.isFinite(n) && s > 0 ? (g - n) / s : NaN
  }
  return out
}

// 오츠 임계값. 값 범위 -1에서 1을 bins 칸으로 나눠 집단 간 분산이 가장 큰 경계를 고른다
export function otsu(values, bins = 256, lo = -1, hi = 1) {
  const hist = new Float64Array(bins)
  let total = 0
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    const k = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)))
    hist[k] += 1
    total += 1
  }
  if (!total) return null
  let sumAll = 0
  for (let i = 0; i < bins; i += 1) sumAll += i * hist[i]
  let w0 = 0
  let sum0 = 0
  let best = -1
  let bestK = 0
  for (let k = 0; k < bins - 1; k += 1) {
    w0 += hist[k]
    if (!w0) continue
    const w1 = total - w0
    if (!w1) break
    sum0 += k * hist[k]
    const m0 = sum0 / w0
    const m1 = (sumAll - sum0) / w1
    const between = w0 * w1 * (m0 - m1) ** 2
    if (between > best) { best = between; bestK = k }
  }
  return lo + ((bestK + 1) / bins) * (hi - lo)
}

// 3집단 오츠. 해안 창에는 식생(낮은 NDWI)과 모래(중간), 물(높은 NDWI) 세 집단이 있어
// 두 집단 오츠는 식생과 모래 사이를 가르기 쉽다. 세 집단으로 나눠 집단 간 분산이 가장 큰 두 경계 중 위 경계(모래와 물 사이)를 쓴다
export function otsu3(values, bins = 128, lo = -1, hi = 1) {
  const hist = new Float64Array(bins)
  let total = 0
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    hist[Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)))] += 1
    total += 1
  }
  if (!total) return null
  const P = new Float64Array(bins + 1)
  const S = new Float64Array(bins + 1)
  for (let i = 0; i < bins; i += 1) { P[i + 1] = P[i] + hist[i]; S[i + 1] = S[i] + i * hist[i] }
  const mu = S[bins] / total
  const part = (a, b) => { const w = P[b] - P[a]; if (!w) return 0; const m = (S[b] - S[a]) / w; return w * (m - mu) ** 2 }
  let best = -1
  let pair = [0, 0]
  for (let i = 1; i < bins - 1; i += 1) {
    for (let j = i + 1; j < bins; j += 1) {
      const v = part(0, i) + part(i, j) + part(j, bins)
      if (v > best) { best = v; pair = [i, j] }
    }
  }
  return pair.map((k) => lo + (k / bins) * (hi - lo))
}

// marching squares. grid 는 w x h 행 우선 배열, level 등치선의 선분을 픽셀 좌표(열, 행)로 돌려준다.
// 칸의 네 꼭짓점 중 NaN 이 있으면 그 칸은 건너뛴다
export function contourSegments(grid, w, h, level) {
  const segs = []
  const lerp = (a, b, va, vb) => a + (b - a) * ((level - va) / (vb - va))
  for (let r = 0; r < h - 1; r += 1) {
    for (let c = 0; c < w - 1; c += 1) {
      const tl = grid[r * w + c]
      const tr = grid[r * w + c + 1]
      const br = grid[(r + 1) * w + c + 1]
      const bl = grid[(r + 1) * w + c]
      if (!Number.isFinite(tl) || !Number.isFinite(tr) || !Number.isFinite(br) || !Number.isFinite(bl)) continue
      const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0)
      if (idx === 0 || idx === 15) continue
      const top = [lerp(c, c + 1, tl, tr), r]
      const right = [c + 1, lerp(r, r + 1, tr, br)]
      const bottom = [lerp(c, c + 1, bl, br), r + 1]
      const left = [c, lerp(r, r + 1, tl, bl)]
      const center = (tl + tr + br + bl) / 4
      switch (idx) {
        case 1: case 14: segs.push([left, bottom]); break
        case 2: case 13: segs.push([bottom, right]); break
        case 3: case 12: segs.push([left, right]); break
        case 4: case 11: segs.push([top, right]); break
        case 6: case 9: segs.push([top, bottom]); break
        case 7: case 8: segs.push([left, top]); break
        case 5: if (center > level) { segs.push([left, top]); segs.push([bottom, right]) } else { segs.push([left, bottom]); segs.push([top, right]) } break
        case 10: if (center > level) { segs.push([left, bottom]); segs.push([top, right]) } else { segs.push([left, top]); segs.push([bottom, right]) } break
        default: break
      }
    }
  }
  return segs
}

// 선분을 끝점끼리 이어 선으로 만든다. 끝점은 소수 6자리로 맞춰 같은 점을 찾는다
export function chainSegments(segs) {
  const key = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`
  const ends = new Map()
  const used = new Uint8Array(segs.length)
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p)
      if (!ends.has(k)) ends.set(k, [])
      ends.get(k).push(i)
    }
  })
  const lines = []
  for (let i = 0; i < segs.length; i += 1) {
    if (used[i]) continue
    used[i] = 1
    const line = [segs[i][0], segs[i][1]]
    for (const dir of [1, -1]) {
      for (;;) {
        const tip = dir === 1 ? line[line.length - 1] : line[0]
        const next = (ends.get(key(tip)) || []).find((j) => !used[j])
        if (next === undefined) break
        used[next] = 1
        const s = segs[next]
        const other = key(s[0]) === key(tip) ? s[1] : s[0]
        if (dir === 1) line.push(other)
        else line.unshift(other)
      }
    }
    lines.push(line)
  }
  return lines
}

export const lineLength = (line) => {
  let d = 0
  for (let i = 1; i < line.length; i += 1) d += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
  return d
}

// 한 장면의 물가선. 픽셀 크기(m)를 곱해 길이가 minLen(m) 이상인 선만 남긴다.
// 돌려주는 좌표는 픽셀 좌표이고 transform 으로 지도 좌표로 바꾼다
export function extractShoreline(green, nir, w, h, { pixel = 10, minLen = 300, level = 'otsu' } = {}) {
  const idx = ndwi(green, nir)
  const t = typeof level === 'number' ? level : level === 'otsu2' ? otsu(idx) : (otsu3(idx)?.[1] ?? null)
  if (t === null) return { threshold: null, lines: [], index: idx, waterShare: 0 }
  let water = 0
  let valid = 0
  for (const v of idx) { if (Number.isFinite(v)) { valid += 1; if (v > t) water += 1 } }
  const lines = chainSegments(contourSegments(idx, w, h, t)).filter((l) => lineLength(l) * pixel >= minLen)
  return { threshold: t, lines, index: idx, waterShare: valid ? water / valid : 0, validShare: valid / idx.length }
}
