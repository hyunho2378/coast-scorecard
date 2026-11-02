// 해안선 지도와 시간 축. 구름으로 끊긴 해안선(MultiLineString)도 조각을 모두 그린다.
// 시간 축은 장면별 거리 비교, 가로선 색은 분석 파일의 최종 판정(hold 속성)을 쓴다
import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import clsx from 'clsx'
import TimeAxis from '../miri/map/TimeAxis.jsx'
import { STYLE_URL } from '../miri/map/mapTheme.js'
import { PAL } from '../lib/palette.js'
import { sceneChanges } from '../lib/judge.js'
import { fmtDate } from '../lib/ledger.js'
import { Card, PageHeader, TestBadge, TideBadge, SiteState, ChangeBars, StateBlock, Stat, HOLD_ACTION } from '../ui/index.jsx'

maplibregl.setWorkerUrl(workerUrl)
const EMPTY = { type: 'FeatureCollection', features: [] }
const fc = (feats) => ({ type: 'FeatureCollection', features: feats.filter((f) => f && f.geometry) })

export default function MapScene({ site, data }) {
  const host = useRef(null)
  const map = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const fitted = useRef(false)
  const ready = data?.status === 'ready'
  const scenes = ready ? data.scenes : []
  const [index, setIndex] = useState(Math.max(0, scenes.length - 1))
  const [playing, setPlaying] = useState(false)

  const steps = scenes.map((s, i) => ({ key: s.id, label: i === 0 ? '기준 장면' : `비교 장면 ${i}`, sub: `${fmtDate(s.date)}${s.segments > 1 ? `(구름으로 ${s.segments}조각)` : ''}`, tick: i === 0 || i === scenes.length - 1 ? fmtDate(s.date) : '' }))
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
    const m = new maplibregl.Map({ container: host.current, style: STYLE_URL.dark, ...(bounds ? { bounds, fitBoundsOptions: opts } : { center: [site.lon, site.lat], zoom: site.zoom }), attributionControl: { compact: true } })
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
  }, [site, ready, bounds])

  useEffect(() => {
    const m = map.current
    if (!loaded || !m || !m.getSource('base') || !ready) return
    m.getSource('base').setData(fc([scenes[0].feature]))
    m.getSource('current').setData(fc(index === 0 ? [] : [scenes[index].feature]))
    m.getSource('transects').setData(fc(data.rows.map((r) => ({ type: 'Feature', geometry: r.geometry, properties: { id: r.id, verdict: r.verdict } }))))
  }, [loaded, ready, data, scenes, index])

  const header = <PageHeader title="해안선 지도와 시간 축" desc={site.name} badges={<><TestBadge />{ready && <TideBadge label={data.tide} />}</>} />
  if (!ready) return <>{header}<SiteState data={data} /></>
  const cur = scenes[index]

  return (
    <>
      {header}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="relative h-[60vh] min-h-[360px] self-start overflow-hidden rounded-md bg-subtle xl:sticky xl:top-2 xl:h-[calc(100vh-140px)] xl:min-h-[520px] w-full">
          <div ref={host} className="absolute inset-0" role="img" aria-label={`${site.name} 해안선과 가로선 지도`} />
          {mapError && <div className="absolute inset-x-3 bottom-3"><StateBlock kind="error" title="바탕 지도를 불러오지 못했습니다">해안선과 가로선은 바탕 지도 없이 그립니다.</StateBlock></div>}
          <div className="absolute left-3 top-3 flex flex-col gap-1 rounded-sm bg-canvas px-3 py-2 shadow-md">
            {[['bg-sand', '기준 장면 해안선'], ['bg-primary', '선택 장면 해안선'], ['bg-advance', '전진 가로선, 최종 판정'], ['bg-retreat', '후퇴 가로선, 최종 판정'], ['bg-hold', '판정 보류 가로선']].map(([c, t]) => (
              <span key={t} className="flex items-center gap-2 type-meta text-text-pri"><span className={clsx('h-1 w-5 rounded-full', c)} aria-hidden="true" />{t}</span>
            ))}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Card>
            <TimeAxis index={index} onIndex={setIndex} steps={steps} playing={playing} onPlaying={setPlaying}
              caption="가로선 바다 쪽 시작점에서 해안선까지 거리를 장면마다 재고, 기준 장면과의 차이를 보여 줍니다. 판정 보류 기준은 가로선마다 분석 파일 값을 씁니다." />
            <p className="mt-2 type-meta text-text-meta">
              {cur && `${fmtDate(cur.date)} 장면, ${cur.tideCorrected ? '조위 보정' : '조위 미보정'}${cur.segments > 1 ? `, 구름으로 끊긴 해안선 ${cur.segments}조각` : ''}`}
            </p>
          </Card>
          <Card title="이 장면 비교">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="전진" value={cnt('advance')} unit="개" tone="advance" />
              <Stat label="후퇴" value={cnt('retreat')} unit="개" tone="retreat" />
              <Stat label="보류" value={cnt('hold') + cnt('nodata')} unit="개" tone="hold" />
            </div>
            {index === 0 && <p className="mt-2 type-meta text-text-meta">기준 장면끼리 비교라 모든 값이 0입니다.</p>}
            {cnt('nodata') > 0 && <p className="mt-2 type-meta text-text-meta">{cnt('nodata')}개 가로선은 구름으로 이 장면 해안선을 찾지 못했습니다. {HOLD_ACTION}</p>}
          </Card>
          <Card title="장면별 이동 거리">
            <ChangeBars rows={sceneRows} label="선택 장면 가로선별 이동 거리" />
          </Card>
        </aside>
      </div>
    </>
  )
}
