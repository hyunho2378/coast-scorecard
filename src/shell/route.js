// 주소 해시로 화면과 사업지를 기억한다. 예: #/card?site=banam
import { useEffect, useState } from 'react'

export const NAV = [
  { id: 'home', label: '현황판', group: 'work' },
  { id: 'analyze', label: '사업지 분석', group: 'work' },
  { id: 'card', label: '판정 카드', group: 'work', site: true },
  { id: 'map', label: '해안선 지도', group: 'work', site: true },
  { id: 'compare', label: '전후 영상', group: 'work', site: true },
  { id: 'storm', label: '점검 순서 목록', group: 'work' },
  { id: 'history', label: '분석 기록', group: 'record' },
  { id: 'rules', label: '운영 기준', group: 'record' },
  { id: 'docs', label: '문서 센터', group: 'record' },
  { id: 'sources', label: '자료와 출처', group: 'outside' }
]
export const GROUPS = [['work', '업무'], ['record', '기록'], ['outside', '외부']]

export function parse(hash = location.hash) {
  const h = String(hash).replace(/^#\/?/, '')
  const [path, q] = h.split('?')
  const params = new URLSearchParams(q || '')
  const screen = NAV.some((n) => n.id === path) ? path : 'home'
  return { screen, site: params.get('site') }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse())
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (screen, site) => {
    const s = site ?? route.site
    location.hash = `#/${screen}${s ? `?site=${s}` : ''}`
  }
  return [route, go]
}
