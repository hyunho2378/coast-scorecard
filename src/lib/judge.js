// 가로선 판정 규칙. 값과 보류 여부는 분석 파일(transects.geojson)의 속성을 그대로 쓴다.
// change_m 양수는 바다 쪽 전진, 음수는 육지 쪽 후퇴. hold 가 참이면 정규 측량 일정.
// hold 속성이 없는 파일만 hold_threshold_m 와 비교해 보류를 정한다. 앱 고정 기준값은 두지 않는다

export const VERDICT = {
  advance: { label: '전진', note: '바다 쪽 이동' },
  retreat: { label: '후퇴', note: '육지 쪽 이동' },
  hold: { label: '정규 측량 일정', note: '위성 오차 이하' },
  nodata: { label: '정규 측량 일정', note: '구름으로 해안선 미검출' },
  few: { label: '정규 측량 일정', note: '한 시점 장면 1장' },
  struct: { label: '구조물 의심, 제외', note: '물가선이 구조물이나 암초 위에서 잡힘' }
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

// 가로선 판정 요약. 정규 측량 일정 비율은 전체 가로선 수를 분모로 쓴다.
// 가로선 수준 값은 가로선 하나의 전후 이동 거리(change). 구간 평균(sectionMean)은 값이 있는 가로선 전체(정규 측량 일정 포함)의 평균이고
// 별표 10 평균 해빈폭 점수와 대장 문구가 함께 쓴다. meanChange 는 변화 확인 가로선만의 평균이라 점수에 쓰지 않는다
// 구조물 의심 가로선(struct)은 정규 측량 일정와 따로 세고 구간 평균에서도 뺀다
export function summarize(rows) {
  const judge = rows.filter((r) => isJudgeable(r.verdict))
  const excluded = rows.filter((r) => r.verdict === 'struct').length
  const held = rows.length - judge.length - excluded
  const ch = judge.map((r) => r.change)
  const all = rows.filter((r) => r.verdict !== 'struct').map((r) => r.change).filter((v) => typeof v === 'number' && !Number.isNaN(v))
  return {
    sectionMean: all.length ? round1(all.reduce((a, b) => a + b, 0) / all.length) : null,
    sectionN: all.length,
    // 판정 대상: 구조물 의심이 아니고 값이 있으며 두 시점 모두 장면이 최소 장수 이상인 가로선(장면 규칙의 sceneShort 제외)
    targetN: rows.filter((r) => r.verdict !== 'struct' && !r.sceneShort && typeof r.change === 'number' && !Number.isNaN(r.change)).length,
    total: rows.length,
    judgeable: judge.length,
    held,
    excluded,
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
// 구조물 의심 가로선은 장면별 비교에서도 구조물 의심으로 표시한다
export function sceneChanges(transectRows, baseScene, scene) {
  return transectRows.map((r) => {
    const a = r.dist?.[baseScene]
    const b = r.dist?.[scene]
    const change = typeof a === 'number' && typeof b === 'number' ? round1(a - b) : null
    return { id: r.id, change, threshold: r.threshold, verdict: r.verdict === 'struct' ? 'struct' : verdictOf(change, r.threshold, undefined) }
  })
}

// 점검 순서 목록: 변화 확인 가로선만, 변화 절댓값이 큰 순서
export function stormOrder(sites) {
  const out = []
  for (const s of sites) {
    for (const r of s.rows || []) {
      if (isJudgeable(r.verdict)) out.push({ siteId: s.id, siteName: s.name, ...r })
    }
  }
  return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || String(a.siteId).localeCompare(String(b.siteId)) || a.id - b.id)
}

// 정규 측량 일정 기준은 규칙 파일(sensitivity_and_rules.json site_rules)이 정답이다.
// 기준 = max(사업지 같은 계절 장면쌍 차이 90퍼센타일, 공개 측량 대조 오차, 10 m).
// 변화가 기준 이하이거나 그 가로선의 같은 계절 장면쌍 차이가 기준을 넘으면 보류한다
export function ruleVerdict(change, threshold, samepair) {
  if (change === null || change === undefined || Number.isNaN(change)) return 'nodata'
  if (typeof threshold !== 'number') return 'hold'
  if (Math.abs(change) <= threshold) return 'hold'
  const pairs = Object.values(samepair || {}).filter((v) => typeof v === 'number')
  if (!pairs.length || pairs.some((v) => v > threshold)) return 'hold'
  return change > 0 ? 'advance' : 'retreat'
}

// 장면 규칙: 같은 해 같은 계절 장면 2장 이상의 중앙값. 두 시점 모두 2장 이상인 가로선만 판정한다.
// periods 는 규칙 파일 scene_rule.sites[id].periods({ 시점: [장면 id] }). 장면이 1장뿐인 시점이 있으면 few(정규 측량 일정)
export function sceneCount(dist, periods) {
  const out = {}
  for (const [p, ids] of Object.entries(periods || {})) out[p] = ids.filter((id) => typeof dist?.[id] === 'number').length
  return out
}
// min: 시점별 최소 장면 수(운영 기준, 기본 2)
export function applySceneRule(rows, periods, min = 2) {
  if (!periods || Object.keys(periods).length < 2) return rows
  // 장면이 모자란 가로선은 판정이 보류든 아니든 sceneShort 로 표시해 판정 대상 수에서 뺀다
  return rows.map((r) => {
    const n = Object.values(sceneCount(r.dist, periods))
    if (!n.some((k) => k < min)) return r
    return isJudgeable(r.verdict) ? { ...r, verdict: 'few', sceneShort: true } : { ...r, sceneShort: true }
  })
}

// 사이트 구분: 규칙 파일 role. 사업지만 별표 10 점수를 계산한다
export const ROLE = {
  project: '사업지',
  control: '비교 해변',
  overseas_reference: '해외 참고',
  survey_validation: '측량 검증'
}
export const roleOf = (rule) => ROLE[rule?.role] ? rule.role : 'project'
export const scoresSite = (rule) => roleOf(rule) !== 'control'

// 보류 기준 선택: sd1(기본, 선행 연구 위치 오차 16.21 m를 두 시점 변화 오차로 환산한 22.9 m)과 p95(엄격, 44.9 m).
// p95 값이 없는 사이트는 기본 기준을 그대로 쓴다. 화면 이름은 BASES 두 번째 값
export const BASES = [['sd1', '기본'], ['p95', '엄격']]

// 서류의 세 등급 이름. exceed: 보류 기준을 넘는 값(보완 측량 1순위), hold: 보류 기준 이하, struct: 구조물 의심
export const TIER = { exceed: '변화 확인 구간', hold: '정규 측량 일정 구간', struct: '구조물 의심 구간' }
export const tierOf = (v) => (v === 'struct' ? 'struct' : isJudgeable(v) ? 'exceed' : 'hold')
export function thresholdOf(rule, basis = 'sd1') {
  if (!rule || typeof rule.holdThresholdM !== 'number') return null
  if (basis === 'p95' && typeof rule.p95?.threshold_m === 'number') return rule.p95.threshold_m
  return rule.holdThresholdM
}
export function applySiteRule(rows, rule, basis = 'sd1') {
  const t = thresholdOf(rule, basis)
  if (t === null) return rows
  return rows.map((r) => ({ ...r, threshold: t, verdict: ruleVerdict(r.change, t, r.samepair) }))
}

// 구조물 의심 제외: 규칙 파일 site_rules[id].structureExcluded 의 가로선 번호는 판정에서 뺀다(struct)
export function applyStructureRule(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows
  const set = new Set(ids.map(Number))
  return rows.map((r) => (set.has(Number(r.id)) ? { ...r, verdict: 'struct' } : r))
}

// 사이트 판정 순서: 보류 기준, 구조물 의심 제외, 장면 규칙
export function judgeRows(base, rule, periods, basis = 'sd1', min = 2) {
  return applySceneRule(applyStructureRule(applySiteRule(base, rule, basis), rule?.structureExcluded), periods, min)
}

// 시간 축 장면별 판정. 기준 장면 거리에서 선택 장면 거리를 뺀 값에 카드와 같은 judgeRows(보류 기준 선택,
// 구조물 의심 제외, 두 시점 모두 장면 2장 이상 규칙)를 적용한다. 마지막 장면은 최종 판정(rows)을 그대로 쓴다
export function sceneJudge(base, baseScene, scene, rule, periods, basis = 'sd1') {
  const rows = (base || []).map((r) => {
    const a = r.dist?.[baseScene]
    const b = r.dist?.[scene]
    const change = typeof a === 'number' && typeof b === 'number' ? round1(a - b) : null
    return { ...r, change, hold: undefined, verdict: verdictOf(change, r.threshold, undefined) }
  })
  return judgeRows(rows, rule, periods, basis)
}
export function axisRows(data, index, rule, periods, basis = 'sd1') {
  if (data?.status !== 'ready' || !data.scenes?.length) return { mode: 'final', rows: [] }
  const last = data.scenes.length - 1
  if (index >= last) return { mode: 'final', rows: data.rows }
  return { mode: 'scene', rows: sceneJudge(data.base || data.rows, data.scenes[0].id, data.scenes[index].id, rule, periods, basis) }
}

// 별표 10(해양수산부 고시 제2025-181호) 점수 식
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
// 평균 해빈폭: 10 + 10 x (사업후 - 사업전) / 사업전, 최대 20, 최소 10
export function beachWidthScore(w0, change) {
  if (!(w0 > 0) || typeof change !== 'number') return null
  return round1(clamp(10 + 10 * (change / w0), 10, 20))
}
// 목표해안선 적합도: 20 + 20 x (B - A), 최대 40, 최소 20
export function targetFitScore(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null
  return round1(clamp(20 + 20 * (b - a), 20, 40))
}
export const GRADES = [['A', 85], ['B', 75], ['C', 65], ['D', 55], ['E', -Infinity]]
export function gradeOf(total) {
  if (typeof total !== 'number') return null
  return GRADES.find(([, min]) => total >= min)[0]
}
