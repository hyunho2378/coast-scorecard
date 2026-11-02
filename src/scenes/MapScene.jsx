// 장면 2. MapLibre 지도 위 장면별 해안선과 가로선 판정, 미리 TimeAxis 로 촬영 장면 이동, 가로선별 이동 거리 막대
import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import clsx from 'clsx'
import TimeAxis from '../miri/map/TimeAxis.jsx'
import { STYLE_URL } from '../miri/map/mapTheme.js'
import { PAL } from '../lib/palette.js'
import { changes, VERDICT } from '../lib/judge.js'

// 미리 MapCanvas.jsx 와 같은 방식으로 지도 작업자 파일 주소를 지정한다
maplibregl.setWorkerUrl(workerUrl)

const EMPTY = { type: 'FeatureCollection', features: [] }
const fmtDate = (d) => { const [y, m, dd] = d.split('-'); return `${y}. ${Number(m)}. ${Number(dd)}.` }
const BAR_CLASS = { advance: 'bg-success', retreat: 'bg-danger', hold: 'bg-text-sec' }

export default function MapScene({ site, data, judge }) {
  const host = useRef(null)
  const map = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const fitted = useRef(false)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const hold = judge.holdThresholdM

  const scenes = useMemo(() => (data?.shorelines?.data.features || []).map((f) => ({ id: f.properties.scene, date: f.properties.date })), [data])
  const steps = scenes.map((s, i) => ({ key: s.id, label: i === 0 ? '기준 장면' : `비교 장면 ${i}`, sub: fmtDate(s.date), tick: i === 0 || i === scenes.length - 1 ? fmtDate(s.date) : '' }))
  const rows = useMemo(() => {
    if (!data?.ready || !scenes.length) return []
    return changes(data.transects.data, scenes[0].id, scenes[index].id, hold)
  }, [data, scenes, index, hold])
  const count = (k) => rows.filter((r) => r.verdict === k).length

  useEffect(() => { setIndex(Math.max(0, scenes.length - 2)); setPlaying(false) }, [scenes])

  useEffect(() => {
    const m = new maplibregl.Map({
      container: host.current, style: STYLE_URL.light, center: [site.lon, site.lat], zoom: site.zoom,
      attributionControl: { compact: true }
    })
    map.current = m
    fitted.current = false
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource('base', { type: 'geojson', data: EMPTY })
      m.addSource('current', { type: 'geojson', data: EMPTY })
      m.addSource('transects', { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'transects', type: 'line', source: 'transects', paint: { 'line-color': ['match', ['get', 'verdict'], 'advance', PAL.advance, 'retreat', PAL.retreat, PAL.hold], 'line-width': 2 } })
      m.addLayer({ id: 'base-halo', type: 'line', source: 'base', paint: { 'line-color': PAL.halo, 'line-width': 7 } })
      m.addLayer({ id: 'base', type: 'line', source: 'base', paint: { 'line-color': PAL.base, 'line-width': 4 } })
      m.addLayer({ id: 'current-halo', type: 'line', source: 'current', paint: { 'line-color': PAL.halo, 'line-width': 7 } })
      m.addLayer({ id: 'current', type: 'line', source: 'current', paint: { 'line-color': PAL.current, 'line-width': 4 } })
      setLoaded(true)
    })
    return () => { setLoaded(false); m.remove() }
  }, [site])

  useEffect(() => {
    const m = map.current
    // 사업지를 바꾸면 새 지도가 막 만들어진 상태라 층이 아직 없을 수 있다
    if (!loaded || !m || !m.getSource('base')) return
    if (!data?.ready || !scenes.length) {
      ;['base', 'current', 'transects'].forEach((id) => m.getSource(id).setData(EMPTY))
      return
    }
    const feats = data.shorelines.data.features
    if (!fitted.current) {
      const xs = [], ys = []
      data.transects.data.features.forEach((f) => f.geometry.coordinates.forEach(([x, y]) => { xs.push(x); ys.push(y) }))
      m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 80, duration: 0 })
      fitted.current = true
    }
    m.getSource('base').setData({ type: 'FeatureCollection', features: [feats[0]] })
    m.getSource('current').setData({ type: 'FeatureCollection', features: index === 0 ? [] : [feats[index]] })
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.verdict]))
    m.getSource('transects').setData({
      type: 'FeatureCollection',
      features: data.transects.data.features.map((f) => ({ ...f, properties: { ...f.properties, verdict: byId[f.properties.id] } }))
    })
  }, [loaded, data, scenes, index, rows])

  const maxAbs = Math.max(hold * 2, ...rows.map((r) => Math.abs(r.change)))

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="relative min-h-[420px] overflow-hidden rounded-md bg-mute">
        <div ref={host} className="absolute inset-0" />
        <div className="absolute left-3 top-3 flex flex-col gap-1 rounded-md bg-page px-3 py-2 shadow-md">
          {[['bg-warning', '기준 장면 해안선'], ['bg-primary', '선택 장면 해안선'], ['bg-success', '가로선 전진'], ['bg-danger', '가로선 후퇴'], ['bg-text-sec', '가로선 판정 보류']].map(([c, t]) => (
            <span key={t} className="flex items-center gap-2 type-meta text-text-pri"><span className={clsx('h-1 w-5 rounded-full', c)} aria-hidden="true" />{t}</span>
          ))}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-auto">
        <section className="rounded-md bg-canvas p-4">
          <h2 className="type-h3 text-text-pri">{site.name}</h2>
          <p className="mt-1 type-meta text-text-meta">{site.source.map((line, i) => <span key={i} className="block">{line}</span>)}</p>
        </section>

        {!data && <section className="rounded-md bg-canvas p-4 type-body-sm text-text-sec">자료 불러오는 중</section>}
        {data && !data.ready && (
          <section className="rounded-md bg-canvas p-4">
            <h3 className="type-strong text-text-pri">분석 자료 준비 중</h3>
            <p className="mt-1 type-body-sm text-text-sec">해안선 분석 파일이 들어오면<br />이 화면에 바로 표시합니다.</p>
          </section>
        )}

        {data?.ready && scenes.length > 0 && (
          <>
            <section className="rounded-md bg-canvas p-4">
              <TimeAxis
                index={index} onIndex={setIndex} steps={steps} playing={playing} onPlaying={setPlaying}
                caption={`가로선 바다 쪽 시작점에서 해안선까지 거리를 장면마다 재고, 기준 장면과의 차이를 이동 거리로 씁니다. ${hold} m 미만은 판정 보류입니다. 기준: ${judge.basis}`}
              />
            </section>

            <section className="rounded-md bg-canvas p-4">
              <div className="grid grid-cols-3 gap-2">
                {['advance', 'retreat', 'hold'].map((k) => (
                  <div key={k} className="rounded-md bg-page px-3 py-2">
                    <p className="type-caption text-text-sec">{VERDICT[k].label}</p>
                    <p className="type-kpi text-text-pri">{count(k)}<span className="ml-1 type-meta text-text-meta">개</span></p>
                  </div>
                ))}
              </div>
              <p className="mt-2 type-meta text-text-meta">이동 거리 {hold} m 미만은 오차 이하라서 판정 보류입니다.</p>
            </section>

            <section className="rounded-md bg-canvas p-4">
              <h3 className="type-strong text-text-pri">가로선별 이동 거리</h3>
              <p className="type-meta text-text-meta">오른쪽은 바다 쪽 전진, 왼쪽은 육지 쪽 후퇴</p>
              <ul className="mt-3 flex flex-col gap-1">
                {rows.map((r) => (
                  <li key={r.id} className="grid grid-cols-[52px_minmax(0,1fr)_132px] items-center gap-2">
                    <span className="type-meta text-text-sec tabular-nums">가로선 {r.id}</span>
                    <span className="relative h-3 rounded-full bg-page" aria-hidden="true">
                      <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                      <span
                        className={clsx('absolute inset-y-0 rounded-full', BAR_CLASS[r.verdict])}
                        style={r.change >= 0
                          ? { left: '50%', width: `${(r.change / maxAbs) * 50}%` }
                          : { right: '50%', width: `${(-r.change / maxAbs) * 50}%` }}
                      />
                    </span>
                    <span className="flex items-center justify-end gap-1 tabular-nums">
                      <span className="type-meta text-text-pri">{r.change > 0 ? '+' : ''}{r.change.toFixed(1)} m</span>
                      <span className={clsx('rounded-md px-2 type-caption', r.verdict === 'advance' ? 'bg-success text-text-inverse' : r.verdict === 'retreat' ? 'bg-danger text-text-inverse' : 'bg-text-sec text-text-inverse')}>
                        {r.verdict === 'hold' ? '보류' : VERDICT[r.verdict].label}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {index === 0 && <p className="mt-2 type-meta text-text-meta">기준 장면끼리 비교라 모든 값이 0입니다.</p>}
            </section>
          </>
        )}
      </aside>
    </div>
  )
}
