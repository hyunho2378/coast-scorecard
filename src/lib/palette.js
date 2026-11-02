// 그래픽 색: tokens.js의 KRDS 변수 이름을 실행 중 실제 값으로 바꾼다. 화면 모드를 바꾸면 다시 읽는다
import { graphic } from '../tokens.js'

function read(name) {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function readPalette() {
  const out = {}
  for (const [k, v] of Object.entries(graphic)) out[k] = Array.isArray(v) ? v.map(read) : read(v)
  return out
}
