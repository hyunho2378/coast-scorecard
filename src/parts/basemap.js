// 바탕 지도 공통 설정. 바탕 타일은 OpenFreeMap(키 불필요, 지도 자료 OpenStreetMap 기여자)이고 화면 모드에 맞춰 고른다
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

export const STYLE_URL = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
maplibregl.setWorkerUrl(workerUrl)
export const EMPTY = { type: 'FeatureCollection', features: [] }
export const fc = (feats) => ({ type: 'FeatureCollection', features: feats.filter((f) => f && f.geometry) })

export function makeMap(container, view, onStyleError) {
  const light = document.documentElement.dataset.krdsMode === 'light'
  const m = new maplibregl.Map({ container, style: light ? STYLE_URL.light : STYLE_URL.dark, ...view, attributionControl: { compact: true } })
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  m.on('error', (e) => { if (String(e?.error?.message || '').includes('style')) onStyleError?.() })
  return m
}
export { maplibregl }
