// 가로선 작업 부품: 지도, 큰 숫자 3개, 선택 가로선 상세, 가로선 목록. 지도와 목록은 같은 선택(selected)을 쓴다
import { useEffect, useMemo, useRef, useState } from 'react'
import { readPalette } from '../lib/palette.js'
import { mapReady } from '../lib/guard.js'
import { useModeTick } from '../shell/screenMode.js'
import { isJudgeable, beachWidthScore, TIER } from '../lib/judge.js'
import { EMPTY, fc, makeMap } from './basemap.js'
import { Bar, TableWrap, Verdict, signed } from '../ui/index.jsx'

// 목록 순서: 변화 확인(이동 거리 큰 순), 구조물 의심 가로선, 정규 측량 일정
const RANK = (v) => (isJudgeable(v) ? 0 : v === 'struct' ? 1 : 2)
export function listOrder(rows) {
  const size = (r) => (typeof r.change === 'number' ? Math.abs(r.change) : -1)
  return [...(rows || [])].sort((a, b) => RANK(a.verdict) - RANK(b.verdict) || size(b) - size(a) || a.id - b.id)
}

export function BigNumbers({ summary }) {
  if (!summary) return null
  return (
    <dl className="cs-big" aria-label="판정 요약">
      <div className="is-key"><dt>{TIER.exceed}</dt><dd className="cs-num">{summary.judgeable}<span>/{summary.total}</span></dd></div>
      <div><dt>{TIER.struct}</dt><dd className="cs-num">{summary.excluded}</dd></div>
      <div><dt>{TIER.hold}</dt><dd className="cs-num">{summary.held}</dd></div>
    </dl>
  )
}

export function TransectDetail({ row, settings }) {
  if (!row) return null
  const pairs = Object.values(row.samepair || {}).filter((v) => typeof v === 'number')
  const maxPair = pairs.length ? Math.max(...pairs) : null
  const score = isJudgeable(row.verdict) || row.verdict === 'hold' ? beachWidthScore(settings.w0, row.change) : null
  return (
    <section className="cs-detail" aria-label={`가로선 ${row.id}번`} aria-live="polite">
      <h2 className="cs-detail-title">가로선 {row.id}번</h2>
      <p className="cs-detail-value cs-num">{typeof row.change === 'number' ? signed(row.change) : '값 없음'}</p>
      <Verdict v={row.verdict} />
      <dl className="cs-detail-kv">
        <div><dt>보류 기준</dt><dd className="cs-num">{row.threshold ?? ''} m</dd></div>
        <div><dt>같은 해 장면 차이</dt><dd className="cs-num">{maxPair === null ? '없음' : `최대 ${maxPair.toFixed(1)} m`}</dd></div>
        <div><dt>위성 값 기준 참고 점수</dt><dd className="cs-num">{typeof score === 'number' ? `${score}점` : '제외'}</dd></div>
        <div><dt>목표선 {settings.offset} m</dt><dd>{typeof row.change === 'number' && row.verdict !== 'struct' ? (row.change >= settings.offset ? '도달' : '미도달') : '제외'}</dd></div>
      </dl>
    </section>
  )
}

export function TransectList({ rows, selected, onSelect, label = '가로선 목록', limit }) {
  const list = useMemo(() => listOrder(rows), [rows])
  const shown = limit ? list.slice(0, limit) : list
  const max = Math.max(...list.map((r) => Math.abs(r.change ?? 0)), (list[0]?.threshold || 10) * 2, 1)
  const ref = useRef(null)
  // 선택 행이 목록 칸 밖이면 목록 칸만 움직인다(화면 전체는 움직이지 않음)
  useEffect(() => {
    const row = ref.current?.querySelector('tr.is-current')
    const box = ref.current?.closest('.cs-table-wrap')
    if (!row || !box) return
    const top = row.offsetTop - (ref.current.tHead?.offsetHeight || 0)
    if (top < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, top)
  }, [selected])
  return (
    <TableWrap label={label}>
      <table className="cs-table is-select" ref={ref}>
        <thead><tr><th>가로선</th><th>판정</th><th className="is-num">이동 거리</th><th className="cs-barcell"><span className="sr-only">막대</span></th></tr></thead>
        <tbody>
          {shown.map((r) => {
            const cur = r.id === selected
            return (
              <tr key={r.id} className={cur ? 'is-current' : undefined} onClick={() => onSelect(r.id)}>
                <td><button type="button" className="cs-rowlink" aria-pressed={cur} onClick={(e) => { e.stopPropagation(); onSelect(r.id) }}>{r.id}번</button></td>
                <td><Verdict v={r.verdict} /></td>
                <td className="is-num">{signed(r.change)}</td>
                <td className="cs-barcell"><Bar value={r.change} max={max} verdict={r.verdict} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableWrap>
  )
}

// 해안선과 가로선 지도. 가로선을 누르면 onSelect(id), 선택한 가로선은 굵게 그린다
export function TransectMap({ site, data, selected, onSelect, label, extraClass = '' }) {
  const tick = useModeTick()
  const host = useRef(null)
  const map = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const ready = data?.status === 'ready'
  const bounds = useMemo(() => {
    if (!ready) return null
    const xs = [], ys = []
    data.rows.forEach((r) => (r.geometry?.coordinates || []).forEach(([x, y]) => { xs.push(x); ys.push(y) }))
    return xs.length ? [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]] : null
  }, [ready, data])
  const selRef = useRef(onSelect)
  selRef.current = onSelect

  useEffect(() => {
    const PAL = readPalette()
    const opts = { padding: 32, duration: 0 }
    const m = makeMap(host.current, bounds ? { bounds, fitBoundsOptions: opts } : { center: [site.lon, site.lat], zoom: site.zoom || 13 })
    map.current = m
    m.on('load', () => {
      ;['base', 'last', 'transects'].forEach((id) => m.addSource(id, { type: 'geojson', data: EMPTY }))
      m.addLayer({ id: 'base', type: 'line', source: 'base', paint: { 'line-color': PAL.base, 'line-width': 3 } })
      m.addLayer({ id: 'last', type: 'line', source: 'last', paint: { 'line-color': PAL.sats[1], 'line-width': 3 } })
      m.addLayer({ id: 'tr', type: 'line', source: 'transects', filter: ['!=', ['get', 'verdict'], 'struct'], paint: { 'line-color': ['match', ['get', 'verdict'], 'advance', PAL.advance, 'retreat', PAL.retreat, PAL.hold], 'line-width': ['match', ['get', 'verdict'], 'advance', 2.5, 'retreat', 2.5, 1.5], 'line-opacity': ['match', ['get', 'verdict'], 'advance', 1, 'retreat', 1, 0.55] } })
      m.addLayer({ id: 'tr-struct', type: 'line', source: 'transects', filter: ['==', ['get', 'verdict'], 'struct'], paint: { 'line-color': PAL.hold, 'line-width': 1.5, 'line-opacity': 0.55, 'line-dasharray': [1.5, 1.5] } })
      m.addLayer({ id: 'tr-hit', type: 'line', source: 'transects', paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 14 } })
      m.addLayer({ id: 'tr-sel-halo', type: 'line', source: 'transects', filter: ['==', ['get', 'id'], -1], paint: { 'line-color': PAL.halo, 'line-width': 9 } })
      m.addLayer({ id: 'tr-sel', type: 'line', source: 'transects', filter: ['==', ['get', 'id'], -1], paint: { 'line-color': PAL.current, 'line-width': 5 } })
      m.on('click', 'tr-hit', (e) => { const id = e.features?.[0]?.properties?.id; if (id !== undefined) selRef.current?.(Number(id)) })
      m.on('mouseenter', 'tr-hit', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'tr-hit', () => { m.getCanvas().style.cursor = '' })
      setLoaded(true)
    })
    const ro = new ResizeObserver(() => { m.resize(); if (bounds) m.fitBounds(bounds, opts) })
    ro.observe(host.current)
    return () => { ro.disconnect(); setLoaded(false); m.remove() }
  }, [site.id, bounds, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!ready || !mapReady(m, loaded, ['base', 'last', 'transects'])) return
    m.getSource('base').setData(fc([data.scenes[0]?.feature]))
    m.getSource('last').setData(fc([data.scenes[data.scenes.length - 1]?.feature]))
    m.getSource('transects').setData(fc(data.rows.map((r) => ({ type: 'Feature', geometry: r.geometry, properties: { id: r.id, verdict: r.verdict } }))))
  }, [loaded, ready, data])
  useEffect(() => {
    const m = map.current
    if (!mapReady(m, loaded, [], ['tr-sel', 'tr-sel-halo'])) return
    const f = ['==', ['get', 'id'], selected ?? -1]
    m.setFilter('tr-sel', f)
    m.setFilter('tr-sel-halo', f)
  }, [loaded, selected])

  return (
    <div className={`cs-stage ${extraClass}`}>
      <div ref={host} className="cs-stage-fill" role="img" aria-label={label || `${site.name} 해안선과 가로선 지도`} />
      <div className="cs-legend">
        <span><span className="cs-swatch is-base" aria-hidden="true" />사업 전 해안선</span>
        <span><span className="cs-swatch is-sat1" aria-hidden="true" />사업 후 해안선</span>
        <span><span className="cs-swatch is-advance" aria-hidden="true" />변화 확인 전진</span>
        <span><span className="cs-swatch is-retreat" aria-hidden="true" />변화 확인 후퇴</span>
        <span><span className="cs-swatch is-hold" aria-hidden="true" />정규 측량 일정</span>
        <span><span className="cs-swatch is-struct" aria-hidden="true" />구조물 의심</span>
      </div>
    </div>
  )
}
