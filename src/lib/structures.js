// 기존 사업지의 구조물 의심 가로선 번호로 새 분석에 쓸 구조물 다각형을 만든다.
// 번호가 이어지는 가로선끼리 한 묶음으로 보고, 묶음의 첫 가로선과 끝 가로선 양 끝점을 이은 사각형을 다각형으로 쓴다(경위도)
export function idRuns(ids) {
  const xs = [...new Set((ids || []).map(Number))].filter(Number.isFinite).sort((a, b) => a - b)
  const out = []
  for (const x of xs) {
    const last = out[out.length - 1]
    if (last && x === last[last.length - 1] + 1) last.push(x)
    else out.push([x])
  }
  return out
}

export function structurePolygons(rows, ids) {
  const byId = new Map((rows || []).map((r) => [Number(r.id), r]))
  const polys = []
  for (const run of idRuns(ids)) {
    const a = byId.get(run[0])?.geometry?.coordinates
    const b = byId.get(run[run.length - 1])?.geometry?.coordinates
    if (!a || !b || a.length < 2 || b.length < 2) continue
    polys.push([a[0], a[a.length - 1], b[b.length - 1], b[0]])
  }
  return polys
}
