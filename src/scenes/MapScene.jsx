// 해안선 지도와 시간 축. 구름으로 끊긴 해안선(MultiLineString)도 조각을 모두 그린다.
// 시간 축 개수와 표는 판정 카드와 같은 judgeRows 로 센다. 마지막 장면은 최종 판정 기준(카드와 같은 값),
// 중간 장면은 기준 장면과 그 장면의 거리 차이로 센 비교 장면 기준. 가로선 색은 최종 판정을 쓴다
import { useEffect, useMemo, useRef, useState } from 'react'
import { mapReady } from '../lib/guard.js'
import { EMPTY, fc, makeMap } from '../parts/basemap.js'
import TimeAxis from '../parts/TimeAxis.jsx'
import { readPalette } from '../lib/palette.js'
import { useModeTick } from '../shell/screenMode.js'
import { axisRows, summarize, thresholdOf, BASES } from '../lib/judge.js'
import { fmtDate } from '../lib/ledger.js'
import { Bar, Box, PageHead, SiteState, TableWrap, Verdict, signed } from '../ui/index.jsx'


export default function MapScene({ site, data, rules, basis = 'sd1', onRetry }) {
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
  const rule = rules?.data?.site_rules?.[site.id]
  const periods = rules?.data?.scene_rule?.sites?.[site.id]?.periods
  const axis = useMemo(() => axisRows(data, index, rule, periods, basis), [data, index, rule, periods, basis])
  const sceneRows = axis.rows
  const sc = summarize(sceneRows)
  const isFinal = axis.mode === 'final'
  const basisLabel = (BASES.find(([k]) => k === basis) || BASES[0])[1]
  const thr = thresholdOf(rule, basis) ?? data?.summary?.thresholds?.[0]

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
    const m = makeMap(host.current, bounds ? { bounds, fitBoundsOptions: opts } : { center: [site.lon, site.lat], zoom: site.zoom }, () => setMapError(true))
    map.current = m
    fitted.current = false
    const moved = (e) => { if (e.originalEvent) fitted.current = true }
    m.on('dragstart', moved); m.on('zoomstart', moved)
    m.on('load', () => {
      ;['base', 'current', 'transects'].forEach((id) => m.addSource(id, { type: 'geojson', data: EMPTY }))
      m.addLayer({ id: 'transects', type: 'line', source: 'transects', filter: ['!=', ['get', 'verdict'], 'struct'], paint: { 'line-color': ['match', ['get', 'verdict'], 'advance', PAL.advance, 'retreat', PAL.retreat, PAL.hold], 'line-width': 2 } })
      // 구조물 의심 가로선: 판정에서 뺀 가로선을 점선으로 따로 그린다
      m.addLayer({ id: 'transects-struct', type: 'line', source: 'transects', filter: ['==', ['get', 'verdict'], 'struct'], paint: { 'line-color': PAL.hold, 'line-width': 2, 'line-dasharray': [1.5, 1.5] } })
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
    if (!ready || !mapReady(m, loaded, ['base', 'current', 'transects'])) return
    m.getSource('base').setData(fc([scenes[0].feature]))
    m.getSource('current').setData(fc(index === 0 ? [] : [scenes[index].feature]))
    m.getSource('transects').setData(fc(data.rows.map((r) => ({ type: 'Feature', geometry: r.geometry, properties: { id: r.id, verdict: r.verdict } }))))
  }, [loaded, ready, data, scenes, index])

  const header = <PageHead title={`${site.name} 해안선 지도`} meta={ready ? <><span>장면 {scenes.length}장</span><span>가로선 {data.rows.length}개</span><span>보류 기준 {thr}{'\u00a0'}m({basisLabel})</span></> : null} />
  if (!ready) return <>{header}<SiteState data={data} onRetry={onRetry} /></>
  const max = Math.max((thr || 0) * 2, ...sceneRows.map((r) => Math.abs(r.change ?? 0)), 1)

  return (
    <>
      {header}
      <div className="cs-two is-wide-side">
        <div className="cs-stage">
          <div ref={host} className="cs-stage-fill" role="img" aria-label={`${site.name} 해안선과 가로선 지도`} />
          <div className="cs-legend">
            {[['is-base', '기준 장면 해안선'], ['is-current', '선택 장면 해안선'], ['is-advance', '전진 가로선'], ['is-retreat', '후퇴 가로선'], ['is-hold', '정규 측량 일정 가로선'], data.summary.excluded > 0 && ['is-struct', '구조물 의심 가로선(제외)']].filter(Boolean).map(([c, t]) => (
              <span key={t}><span className={`cs-swatch ${c}`} aria-hidden="true" />{t}</span>
            ))}
          </div>
          {mapError && <p className="cs-stage-caption">바탕 지도 없음</p>}
        </div>
        <aside className="cs-col">
          <Box title="시간 축">
            <TimeAxis index={index} onIndex={setIndex} steps={steps} playing={playing} onPlaying={setPlaying} />
          </Box>
          <p className="cs-axis-basis"><strong>{isFinal ? '최종 판정' : `${steps[index]?.label} 비교`}</strong></p>
          <div className="cs-axis-counts">
            <ul className="cs-counts" aria-label={`${isFinal ? '최종 판정 기준' : '비교 장면 기준'} 판정 개수`}>
              <li><strong>{sc.judgeable}</strong>변화 확인</li>
              <li><strong>{sc.held}</strong>정규 측량 일정</li>
              {sc.excluded > 0 && <li><strong>{sc.excluded}</strong>구조물 의심 제외</li>}
            </ul>
            <ul className="cs-counts" aria-label={`${isFinal ? '최종 판정 기준' : '비교 장면 기준'} 방향 개수`}>
              <li><strong>{sc.advance}</strong>전진</li>
              <li><strong>{sc.retreat}</strong>후퇴</li>
            </ul>
          </div>
          <Box title="장면별 이동 거리" sub={isFinal ? '최종 판정' : '비교 장면'} flush>
            <TableWrap label="장면별 이동 거리 표">
              <table className="cs-table is-compact">
                <thead><tr><th>가로선</th><th className="is-num">이동</th><th><span className="sr-only">막대</span></th><th>판정</th></tr></thead>
                <tbody>
                  {sceneRows.map((r) => (
                    <tr key={r.id}><td className="cs-num">{r.id}</td><td className="is-num">{signed(r.change)}</td><td><Bar value={r.change} max={max} verdict={r.verdict} /></td><td><Verdict v={r.verdict} /></td></tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Box>
        </aside>
      </div>
    </>
  )
}
