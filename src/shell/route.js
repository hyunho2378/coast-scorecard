// 주소 해시로 화면과 사업지를 기억한다. 예: #/card?site=banam
import { useEffect, useState } from 'react'

export const NAV = [
  { id: 'globe', label: '지구본' },
  { id: 'sites', label: '사업지 목록' },
  { id: 'card', label: '판정 카드' },
  { id: 'map', label: '해안선 지도' },
  { id: 'compare', label: '전후 영상 비교' },
  { id: 'storm', label: '점검 순서 목록' },
  { id: 'sources', label: '자료와 출처' }
]

function parse() {
  const h = location.hash.replace(/^#\/?/, '')
  const [path, q] = h.split('?')
  const params = new URLSearchParams(q || '')
  const screen = NAV.some((n) => n.id === path) ? path : 'globe'
  return { screen, site: params.get('site') }
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
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
