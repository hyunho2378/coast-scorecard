// 가로선 판정 규칙. 값과 보류 여부는 분석 파일(transects.geojson)의 속성을 그대로 쓴다.
// change_m 양수는 바다 쪽 전진, 음수는 육지 쪽 후퇴. hold 가 참이면 판정 보류.
// hold 속성이 없는 파일만 hold_threshold_m 와 비교해 보류를 정한다. 앱 고정 기준값은 두지 않는다

export const VERDICT = {
  advance: { label: '전진', note: '바다 쪽 이동' },
  retreat: { label: '후퇴', note: '육지 쪽 이동' },
  hold: { label: '판정 보류', note: '위성 오차 이하' },
  nodata: { label: '판정 보류', note: '구름으로 해안선 미검출' }
}

export function round1(v) { return Math.round(v * 10) / 10 }

export function verdictOf(change, threshold, holdFlag) {
  if (change === null || change === undefined || Number.isNaN(change)) return 'nodata'
  if (holdFlag === true) return 'hold'
  if (holdFlag === undefined || holdFlag === null) {
    if (typeof threshold !== 'number') return 'hold'
    if (Math.abs(change) < threshold) return 'hold'
  }
  return change > 0 ? 'advance' : 'retreat'
}

export const isJudgeable = (v) => v === 'advance' || v === 'retreat'

export function median(xs) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// 가로선 판정 요약. 판정 보류 비율은 전체 가로선 수를 분모로 쓴다
export function summarize(rows) {
  const judge = rows.filter((r) => isJudgeable(r.verdict))
  const held = rows.length - judge.length
  const ch = judge.map((r) => r.change)
  return {
    total: rows.length,
    judgeable: judge.length,
    held,
    nodata: rows.filter((r) => r.verdict === 'nodata').length,
    advance: rows.filter((r) => r.verdict === 'advance').length,
    retreat: rows.filter((r) => r.verdict === 'retreat').length,
    judgeableRatio: rows.length ? judge.length / rows.length : 0,
    heldRatio: rows.length ? held / rows.length : 0,
    medianChange: ch.length ? round1(median(ch)) : null,
    meanChange: ch.length ? round1(ch.reduce((a, b) => a + b, 0) / ch.length) : null,
    minChange: ch.length ? Math.min(...ch) : null,
    maxChange: ch.length ? Math.max(...ch) : null,
    thresholds: [...new Set(rows.map((r) => r.threshold).filter((t) => typeof t === 'number'))]
  }
}

// 시간 축용 장면별 비교. 기준 장면 거리에서 선택 장면 거리를 뺀다. 보류 기준은 가로선마다 파일 값
export function sceneChanges(transectRows, baseScene, scene) {
  return transectRows.map((r) => {
    const a = r.dist?.[baseScene]
    const b = r.dist?.[scene]
    const change = typeof a === 'number' && typeof b === 'number' ? round1(a - b) : null
    return { id: r.id, change, threshold: r.threshold, verdict: verdictOf(change, r.threshold, undefined) }
  })
}

// 폭풍 뒤 점검 목록: 판정 가능 가로선만, 변화 절댓값이 큰 순서
export function stormOrder(sites) {
  const out = []
  for (const s of sites) {
    for (const r of s.rows || []) {
      if (isJudgeable(r.verdict)) out.push({ siteId: s.id, siteName: s.name, ...r })
    }
  }
  return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || String(a.siteId).localeCompare(String(b.siteId)) || a.id - b.id)
}
