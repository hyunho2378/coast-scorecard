// 별표 10 점수 계산기. 운영 기준(사업 전 해빈폭, 목표 해안선 거리, 해빈 경사)을 바꾸면 이 함수로 다시 계산한다
import { beachWidthScore, gradeOf, round1, summarize, targetFitScore } from './judge.js'

// 목표 해안선은 가로선마다 사업 전 해안선에서 바다 쪽 offset(m) 떨어진 선이다.
// A는 사업 전 해안선이 목표선에 닿은 가로선 비율(offset 이 0 이하면 1, 양수면 0), B는 사업 후 이동 거리가 offset 이상인 가로선 비율.
// 대상은 이동 거리가 있는 가로선(구조물 의심 제외, 정규 측량 일정 포함)으로 구간 평균과 같다
export function targetShares(rows, offset) {
  const xs = (rows || []).filter((r) => r.verdict !== 'struct' && typeof r.change === 'number')
  if (!xs.length) return { a: null, b: null, n: 0 }
  const a = offset <= 0 ? 1 : 0
  const b = xs.filter((r) => r.change >= offset).length / xs.length
  return { a, b: Math.round(b * 1000) / 1000, n: xs.length }
}

// 조위 차이(m)를 해빈 경사(세로/가로)로 나눈 수평 이동 거리(m)
export function tideShift(dh, slope) {
  if (!(slope > 0) || typeof dh !== 'number') return null
  return round1(dh / slope)
}

export function annexScore(rows, { w0 = 50, offset = 10 } = {}) {
  const s = summarize(rows || [])
  const t = targetShares(rows, offset)
  const beach = beachWidthScore(w0, s.sectionMean)
  const fit = t.n ? targetFitScore(t.a, t.b) : null
  const sum = typeof beach === 'number' && typeof fit === 'number' ? round1(beach + fit) : null
  return { mean: s.sectionMean, n: s.sectionN, beach, a: t.a, b: t.b, fit, sum, max: 60 }
}

// 위성으로 채우는 두 항목(해빈폭 20점, 목표해안선 적합도 40점) 밖의 40점을 other 로 받아 등급을 낸다
export function gradeWith(sum, other) {
  if (typeof sum !== 'number' || typeof other !== 'number') return null
  return gradeOf(sum + other)
}
