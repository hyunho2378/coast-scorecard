// 화면 모드: 어두운 화면(기본), 밝은 화면, 선명한 화면 모드, 시스템 따르기. 공공 깃랩 ScreenMode와 같은 값.
// 저장소는 쓰지 않는다. 주소의 ?mode= 값이 있으면 그 값으로 시작한다
import { useEffect, useState } from 'react'

export const MODES = [
  ['dark', '어두운 화면'],
  ['light', '밝은 화면'],
  ['high-contrast', '선명한 화면 모드'],
  ['theme', '시스템 설정 따르기']
]

function apply(mode) {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  const more = matchMedia('(prefers-contrast: more)').matches
  const root = document.documentElement
  root.dataset.krdsPreference = mode
  root.dataset.krdsMode = mode === 'theme' ? (more ? 'high-contrast' : dark ? 'dark' : 'light') : mode
  window.dispatchEvent(new Event('cs-mode'))
}

function initial() {
  const m = new URLSearchParams(location.search).get('mode')
  return MODES.some(([k]) => k === m) ? m : 'dark'
}

export function useScreenMode() {
  const [mode, setMode] = useState(initial)
  useEffect(() => {
    apply(mode)
    const qs = [matchMedia('(prefers-color-scheme: dark)'), matchMedia('(prefers-contrast: more)')]
    const on = () => apply(mode)
    qs.forEach((q) => q.addEventListener('change', on))
    return () => qs.forEach((q) => q.removeEventListener('change', on))
  }, [mode])
  return [mode, setMode]
}

// 그래픽이 화면 모드 바뀜을 따라 색을 다시 읽도록 쓰는 값
export function useModeTick() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const on = () => setN((x) => x + 1)
    window.addEventListener('cs-mode', on)
    return () => window.removeEventListener('cs-mode', on)
  }, [])
  return n
}
