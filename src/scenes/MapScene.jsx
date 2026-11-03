// 해안선 지도와 시간 축. 구름으로 끊긴 해안선(MultiLineString)도 조각을 모두 그린다.
// 시간 축은 장면별 거리 비교, 가로선 색은 분석 파일의 최종 판정(hold 속성)을 쓴다
import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import TimeAxis from '../parts/TimeAxis.jsx'
import { readPalette } from '../lib/palette.js'
import { useModeTick } from '../shell/screenMode.js'
import { sceneChanges } from '../lib/judge.js'
import { fmtDate } from '../lib/ledger.js'
import { Bar, Box, PageHead, SiteState, Verdict, HOLD_ACTION, signed } from '../ui/index.jsx'

// 바탕 타일: OpenFreeMap(키 불필요, 저작권 OpenStreetMap 기여자). 화면 모드에 맞춰 고른다
const STYLE_URL = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }

maplibregl.setWorkerUrl(workerUrl)
const EMPTY = { type: 'FeatureCollection', features: [] }
const fc = (feats) => ({ type: 'FeatureCollection', features: feats.filter((f) => f && f.geometry) })

export default function MapScene({ site, data, onRetry }) {
  const tick = useModeTick()
  const host = useRef(null)
  const map = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const fitted = useRef(false)
  const ready = data?.status === 'ready'
  const scenes = ready ? data.scenes : []
  const [index, setIndex] = useState(Math.max(0, scenes.length - 1))
  const [playing, setPlaying] = useState(false)

  const steps = scenes.map((s, i) => ({ key: s.id, label: i === 0 ? '기준 장면' : `비교 장면 ${i}`, sub: fmtDate(s.date), tick: i === 0 || i === scenes.length - 1 ? fmtDate(s.date) : '' }))
  const sceneRows = useMemo(() => (ready && scenes.length ? sceneChanges(data.rows, scenes[0].id, scenes[index]?.id) : []), [ready, data, scenes, index])
  const cnt = (k) => sceneRows.filter((r) => r.verdict === k).length

  useEffect(() => { setIndex(Math.max(0, scenes.length - 1)); setPlaying(false) }, [scenes.length])

  // 가로선 전체가 들어오는 경계. 지도 상자 크기가 바뀌면 사용자가 움직이기 전까지 다시 맞춘다
  const bounds = useMemo(() => {
    if (!ready) return null
    const xs = [], ys = []
    data.rows.forEach((r) => (r.geometry?.coordinates || []).forEach(([x, y]) => { xs.push(x); ys.push(y) }))
    return xs.length ? [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]] : null
  }, [ready, data])

  useEffect(() => {
    if (!ready) return undefined
    const opts = { padding: 40, duration: 0 }
    const PAL = readPalette()
    const light = document.documentElement.dataset.krdsMode === 'light'
    const m = new maplibregl.Map({ container: host.current, style: light ? STYLE_URL.light : STYLE_URL.dark, ...(bounds ? { bounds, fitBoundsOptions: opts } : { center: [site.lon, site.lat], zoom: site.zoom }), attributionControl: { compact: true } })
    map.current = m
    fitted.current = false
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('error', (e) => { if (String(e?.error?.message || '').includes('style')) setMapError(true) })
    const moved = (e) => { if (e.originalEvent) fitted.current = true }
    m.on('dragstart', moved); m.on('zoomstart', moved)
    m.on('load', () => {
      ;['base', 'current', 'transects'].forEach((id) => m.addSource(id, { type: 'geojson', data: EMPTY }))
      m.addLayer({ id: 'transects', type: 'line', source: 'transects', paint: { 'line-color': ['match', ['get', 'verdict'], 'advance', PAL.advance, 'retreat', PAL.retreat, PAL.hold], 'line-width': 2 } })
      m.addLayer({ id: 'base-halo', type: 'line', source: 'base', paint: { 'line-color': PAL.halo, 'line-width': 7 } })
      m.addLayer({ id: 'base', type: 'line', source: 'base', paint: { 'line-color': PAL.base, 'line-width': 3.5 } })
      m.addLayer({ id: 'current-halo', type: 'line', source: 'current', paint: { 'line-color': PAL.halo, 'line-width': 7 } })
      m.addLayer({ id: 'current', type: 'line', source: 'current', paint: { 'line-color': PAL.current, 'line-width': 3.5 } })
      setLoaded(true)
    })
    const ro = new ResizeObserver(() => { m.resize(); if (bounds && !fitted.current) m.fitBounds(bounds, opts) })
    ro.observe(host.current)
    return () => { ro.disconnect(); setLoaded(false); m.remove() }
  }, [site, ready, bounds, tick])

  useEffect(() => {
    const m = map.current
    if (!loaded || !m || !m.getSource('base') || !ready) return
    m.getSource('base').setData(fc([scenes[0].feature]))
    m.getSource('current').setData(fc(index === 0 ? [] : [scenes[index].feature]))
    m.getSource('transects').setData(fc(data.rows.map((r) => ({ type: 'Feature', geometry: r.geometry, properties: { id: r.id, verdict: r.verdict } }))))
  }, [loaded, ready, data, scenes, index])

  const header = <PageHead title={`${site.name} 해안선 지도`} meta={ready ? <><span>장면 {scenes.length}장</span><span>가로선 {data.rows.length}개</span><span>보류 기준 {data.summary.thresholds[0]}{'\u00a0'}m</span></> : null} />
  if (!ready) return <>{header}<SiteState data={data} onRetry={onRetry} /></>
  const max = Math.max(data.summary.thresholds[0] * 2, ...sceneRows.map((r) => Math.abs(r.change ?? 0)), 1)

  return (
    <>
      {header}
      <div className="cs-two is-wide-side">
        <div className="cs-stage">
          <div ref={host} className="cs-stage-fill" role="img" aria-label={`${site.name} 해안선과 가로선 지도`} />
          <div className="cs-legend">
            {[['is-base', '기준 장면 해안선'], ['is-current', '선택 장면 해안선'], ['is-advance', '전진 가로선'], ['is-retreat', '후퇴 가로선'], ['is-hold', '판정 보류 가로선']].map(([c, t]) => (
              <span key={t}><span className={`cs-swatch ${c}`} aria-hidden="true" />{t}</span>
            ))}
          </div>
          {mapError && <p className="cs-stage-caption">바탕 지도 없이 해안선과 가로선만 그립니다.</p>}
        </div>
        <aside className="cs-col">
          <Box title="시간 축">
            <TimeAxis index={index} onIndex={setIndex} steps={steps} playing={playing} onPlaying={setPlaying} />
          </Box>
          <ul className="cs-counts" aria-label="선택 장면 비교">
            <li><strong>{cnt('advance')}</strong>전진</li>
            <li><strong>{cnt('retreat')}</strong>후퇴</li>
            <li><strong>{cnt('hold') + cnt('nodata')}</strong>판정 보류</li>
          </ul>
          <Box title="장면별 이동 거리" sub="기준 장면 대비" flush foot={HOLD_ACTION}>
            <div className="cs-table-wrap">
              <table className="cs-table is-compact">
                <thead><tr><th>가로선</th><th className="is-num">이동</th><th><span className="sr-only">막대</span></th><th>판정</th></tr></thead>
                <tbody>
                  {sceneRows.map((r) => (
                    <tr key={r.id}><td className="cs-num">{r.id}</td><td className="is-num">{signed(r.change)}</td><td><Bar value={r.change} max={max} verdict={r.verdict} /></td><td><Verdict v={r.verdict} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Box>
        </aside>
      </div>
    </>
  )
}
