// 가로선별 이동 거리와 판정. 거리 값은 가로선 바다 쪽 시작점에서 해안선까지의 길이(m)라
// 기준 시점보다 값이 작아지면 해안선이 바다 쪽으로 나간 상태(전진)다
export const VERDICT = {
  hold: { label: '판정 보류', note: '오차 이하' },
  advance: { label: '전진', note: '바다 쪽 이동' },
  retreat: { label: '후퇴', note: '육지 쪽 이동' }
}

export function verdictOf(changeM, holdM) {
  if (Math.abs(changeM) < holdM) return 'hold'
  return changeM > 0 ? 'advance' : 'retreat'
}

// transects: GeoJSON FeatureCollection. properties.dist_m 이 장면별 거리이거나, change_m 하나만 있을 수 있다
export function changes(transects, baseScene, scene, holdM) {
  return transects.features.map((ft) => {
    const p = ft.properties
    const change = p.dist_m ? p.dist_m[baseScene] - p.dist_m[scene] : (p.change_m ?? 0)
    const v = Math.round(change * 10) / 10
    return { id: p.id, change: v, verdict: verdictOf(v, holdM) }
  })
}
