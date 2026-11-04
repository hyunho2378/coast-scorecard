// 사업지 분석. 지도에서 점을 찍거나 위도와 경도를 넣고(또는 사업지 목록에서 고르고) 두 시점과 계절을 골라
// 브라우저가 Sentinel-2 를 직접 읽어 판정까지 돌린다. 구조물 다각형을 그리면 30 m 이내 가로선을 구조물 의심으로 뺀다.
// 재현 기준(첫 선택값)은 현황판 사업지와 같은 장면, 같은 가로선, 같은 구조물 의심 가로선으로 다시 계산해 현황판 숫자를 그대로 재현한다
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, Import, LoaderCircle, Pentagon, Play, Square, Trash2 } from 'lucide-react'
import { structurePolygons } from '../lib/structures.js'
import { Box, ErrorLine, Field, PageHead, Pick, Segmented } from '../ui/index.jsx'
import { readPalette } from '../lib/palette.js'
import { useModeTick } from '../shell/screenMode.js'
import { EMPTY, fc, makeMap } from '../parts/basemap.js'
import { mapReady } from '../lib/guard.js'
import { SEASONS } from '../engine/stac.js'
import { FAIL, STAGES } from '../engine/analyze.js'
import { REPRO_STAGES } from '../engine/repro.js'
import { fromUtm } from '../engine/utm.js'
import { boardDiff, boardDiffLine, runLine } from '../lib/runs.js'

const YEARS = Array.from({ length: 11 }, (_, i) => 2016 + i).map((y) => [y, `${y}년`])
const SPACING = [50, 100, 200].map((v) => [v, `${v} m`])
const BOX_M = 2000
const num = (v) => (v === '' || v === null ? NaN : Number(v))
const MODES = [['repro', '재현 기준'], ['auto', '자동 가로선']]
const sceneDate = (id) => { const m = String(id).match(/_(\d{4})(\d{2})(\d{2})_/); return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : id }

// 재현 기준 분석 창(UTM 상자)을 경위도 고리로
function aoiRing(r) {
  const [E0, N1, W, H] = r.aoi
  return [[E0, N1], [E0 + W, N1], [E0 + W, N1 - H], [E0, N1 - H], [E0, N1]].map(([x, y]) => { const g = fromUtm(x, y, r.zone, r.south); return [g.lon, g.lat] })
}

// 경위도 점 둘레 정사각형(한 변 BOX_M)
function boxRing(lon, lat) {
  const dy = BOX_M / 2 / 110950
  const dx = BOX_M / 2 / (111320 * Math.cos((lat * Math.PI) / 180))
  return [[lon - dx, lat - dy], [lon + dx, lat - dy], [lon + dx, lat + dy], [lon - dx, lat + dy], [lon - dx, lat - dy]]
}

export default function AnalyzeScreen({ sites, siteData, rules, settings, job, onRun, onStop, onOpen }) {
  const tick = useModeTick()
  const host = useRef(null)
  const map = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const presets = sites.filter((s) => !s.run)
  const reproSites = presets.filter((s) => s.repro)
  const [mode, setMode] = useState(reproSites.length ? 'repro' : 'auto')
  const [preset, setPreset] = useState(presets[0]?.id || '')
  const [lat, setLat] = useState(String(presets[0]?.lat ?? ''))
  const [lon, setLon] = useState(String(presets[0]?.lon ?? ''))
  const [name, setName] = useState(presets[0] ? `${presets[0].name} ${reproSites.length ? '재현 기준' : '새 분석'}` : '')
  const [beforeYear, setBefore] = useState(2017)
  const [afterYear, setAfter] = useState(2025)
  const [season, setSeason] = useState('spring')
  const [spacing, setSpacing] = useState(settings.spacing)
  const [drawing, setDrawing] = useState(false)
  const [ring, setRing] = useState([])
  const [polys, setPolys] = useState([])
  const drawRef = useRef(false)
  drawRef.current = drawing
  const reproRef = useRef(false)

  const la = num(lat)
  const lo = num(lon)
  const posOk = Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 84 && Math.abs(lo) <= 180
  const yearsOk = beforeYear < afterYear
  const running = job?.status === 'running'
  reproRef.current = mode === 'repro'
  const canRun = posOk && yearsOk && !running

  const choosePreset = (id, m = mode) => {
    const s = presets.find((x) => x.id === id)
    setPreset(id)
    if (s) { setLat(String(s.lat)); setLon(String(s.lon)); setName(`${s.name} ${m === 'repro' ? '재현 기준' : '새 분석'}`) }
  }
  const chooseMode = (m) => {
    setMode(m)
    setDrawing(false); setRing([])
    if (m === 'repro') choosePreset(reproSites.some((s) => s.id === preset) ? preset : reproSites[0]?.id || '', m)
    else { setPolys([]); choosePreset(preset, m) }
  }
  const repro = mode === 'repro'
  const reproSite = repro ? reproSites.find((s) => s.id === preset) || null : null

  // 고른 사업지에 기존 구조물 의심 가로선이 있으면 그 위치로 다각형을 만든다
  const presetIds = preset ? rules?.data?.site_rules?.[preset]?.structureExcluded || [] : []
  const presetRows = preset && siteData[preset]?.status === 'ready' ? siteData[preset].base || siteData[preset].rows : null
  const reproRows = reproSite ? presetRows : null
  const reproPeriods = reproSite ? rules?.data?.scene_rule?.sites?.[preset]?.periods || null : null
  const reproDates = reproPeriods ? Object.values(reproPeriods).flat().map((id) => [id.match(/_(\d{8})_/)?.[1] || id, id]).sort().map(([, id]) => sceneDate(id)) : []
  const [reproStructs, setReproStructs] = useState(false)
  const reproStructIds = reproStructs ? presetIds : []
  const reproOk = Boolean(reproSite && reproRows && reproPeriods)

  useEffect(() => {
    const PAL = readPalette()
    const m = makeMap(host.current, { center: [lo || 128.4637, la || 38.4236], zoom: 12.5 })
    map.current = m
    m.on('load', () => {
      ;['box', 'point', 'polys', 'ring', 'transects'].forEach((id) => m.addSource(id, { type: 'geojson', data: EMPTY }))
      m.addLayer({ id: 'transects', type: 'line', source: 'transects', paint: { 'line-color': PAL.current, 'line-width': 1, 'line-opacity': 0.7 } })
      m.addLayer({ id: 'box', type: 'line', source: 'box', paint: { 'line-color': PAL.current, 'line-width': 2, 'line-dasharray': [2, 1.5] } })
      m.addLayer({ id: 'polys-fill', type: 'fill', source: 'polys', paint: { 'fill-color': PAL.retreat, 'fill-opacity': 0.25 } })
      m.addLayer({ id: 'polys', type: 'line', source: 'polys', paint: { 'line-color': PAL.retreat, 'line-width': 2 } })
      m.addLayer({ id: 'ring', type: 'line', source: 'ring', paint: { 'line-color': PAL.retreat, 'line-width': 2, 'line-dasharray': [1, 1] } })
      m.addLayer({ id: 'ring-pts', type: 'circle', source: 'ring', paint: { 'circle-radius': 4, 'circle-color': PAL.retreat } })
      m.addLayer({ id: 'point', type: 'circle', source: 'point', paint: { 'circle-radius': 7, 'circle-color': PAL.current, 'circle-stroke-width': 2, 'circle-stroke-color': PAL.halo } })
      m.on('click', (e) => {
        const p = [Math.round(e.lngLat.lng * 1e5) / 1e5, Math.round(e.lngLat.lat * 1e5) / 1e5]
        if (drawRef.current) setRing((r) => [...r, p])
        else if (!reproRef.current) { setLon(String(p[0])); setLat(String(p[1])); setPreset('') }
      })
      setLoaded(true)
    })
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(host.current)
    return () => { ro.disconnect(); setLoaded(false); m.remove() }
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!mapReady(m, loaded, ['point', 'box', 'transects'])) return
    if (posOk) {
      m.getSource('point').setData(fc(reproSite ? [] : [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lo, la] } }]))
      m.getSource('box').setData(fc([{ type: 'Feature', geometry: { type: 'LineString', coordinates: reproSite ? aoiRing(reproSite.repro) : boxRing(lo, la) } }]))
    }
    m.getSource('transects').setData(fc(reproSite && reproRows ? reproRows.map((r) => ({ type: 'Feature', geometry: r.geometry })) : []))
  }, [loaded, lo, la, posOk, reproSite, reproRows])
  useEffect(() => {
    const m = map.current
    if (!loaded || !m || !posOk) return
    const c = m.getCenter()
    if (Math.abs(c.lng - lo) > 0.01 || Math.abs(c.lat - la) > 0.01) m.easeTo({ center: [lo, la], zoom: Math.max(m.getZoom(), 12.5), duration: 300 })
  }, [loaded, preset]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = map.current
    if (!mapReady(m, loaded, ['polys', 'ring'])) return
    m.getSource('polys').setData(fc(polys.map((p) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...p, p[0]]] } }))))
    m.getSource('ring').setData(fc(ring.length ? [{ type: 'Feature', geometry: ring.length > 1 ? { type: 'LineString', coordinates: ring } : { type: 'Point', coordinates: ring[0] } }, ...ring.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p } }))] : []))
    m.getCanvas().style.cursor = drawing ? 'crosshair' : ''
  }, [loaded, polys, ring, drawing])

  const loadStructures = () => { setPolys(structurePolygons(presetRows, presetIds)); setRing([]); setDrawing(false); setReproStructs(true) }
  // 재현 기준에서는 사업지를 고르면 구조물 의심 가로선을 바로 불러온다
  useEffect(() => {
    if (repro && presetRows) { setPolys(structurePolygons(presetRows, presetIds)); setReproStructs(true) }
  }, [repro, preset, Boolean(presetRows)]) // eslint-disable-line react-hooks/exhaustive-deps
  const closeRing = () => { if (ring.length >= 3) { setPolys((x) => [...x, ring]); setRing([]); setDrawing(false) } }
  const params = useMemo(() => ({
    lon: lo, lat: la, beforeYear, afterYear, season, spacing, boxM: BOX_M,
    maxCloud: settings.maxCloud, minScenes: settings.minScenes, maxScenes: settings.maxScenes,
    structures: polys.map((p) => [...p, p[0]])
  }), [lo, la, beforeYear, afterYear, season, spacing, settings, polys])
  const run = (over = {}) => {
    if (repro) {
      if (!reproOk) return
      const features = reproRows.map((r) => ({ type: 'Feature', properties: { id: r.id }, geometry: r.geometry }))
      onRun({ mode: 'repro', siteId: preset, structureIds: reproStructIds, cfg: { ...reproSite.repro, periods: reproPeriods, features } }, name.trim())
      return
    }
    if (over.season) setSeason(over.season)
    onRun({ ...params, ...over }, name.trim())
  }

  const stageState = (i) => {
    if (!job) return 'wait'
    if (job.status === 'done') return 'done'
    if (job.status === 'error') return i < job.stage ? 'done' : i === job.stage ? 'fail' : 'wait'
    return i < job.stage ? 'done' : i === job.stage ? 'now' : 'wait'
  }
  const resData = job?.status === 'done' ? siteData[job.id] : null
  const resLine = resData?.status === 'ready' ? runLine({ data: resData, rule: rules?.data?.site_rules?.[job.id] }) : null
  const jobRepro = (job?.params?.mode || mode) === 'repro'
  // 재현 기준 결과만: 엔진 값과 현황판 가로선 값의 최대 차이를 화면에서 계산한다
  const boardBase = jobRepro && resData?.status === 'ready' && job?.params?.siteId && siteData[job.params.siteId]?.status === 'ready' ? siteData[job.params.siteId].base : null
  const diffLine = boardBase ? boardDiffLine(boardDiff(resData.base, boardBase)) : ''
  const stages = jobRepro ? REPRO_STAGES : STAGES
  const others = SEASONS.filter(([k]) => k !== (job?.params?.season || season))

  return (
    <>
      <PageHead title="사업지 분석" meta={repro && reproSite
        ? <><span>Sentinel-2 L2A</span><span>분석 범위 {reproSite.repro.aoi[2] / 1000} km x {reproSite.repro.aoi[3] / 1000} km</span><span>가로선 간격 {reproSite.repro.spacingM} m</span></>
        : <><span>Sentinel-2 L2A</span><span>분석 범위 2 km x 2 km</span><span>가로선 간격 {spacing} m</span></>} />
      <div className="cs-split is-tool">
        <div className="cs-stage is-tool">
          <div ref={host} className="cs-stage-fill" role="img" aria-label="분석 위치 지도" />
          <div className="cs-maptools" role="toolbar" aria-label="구조물 다각형">
            {!repro && <button type="button" className={`krds-btn small ${drawing ? 'primary' : 'secondary'}`} aria-pressed={drawing} onClick={() => { setDrawing(!drawing); setRing([]) }}><Pentagon size={16} aria-hidden="true" />구조물 그리기</button>}
            {drawing && <button type="button" className="krds-btn small secondary" disabled={ring.length < 3} onClick={closeRing}><Check size={16} aria-hidden="true" />닫기 {ring.length}점</button>}
            {presetIds.length > 0 && presetRows && <button type="button" className={`krds-btn small ${repro && reproStructs ? 'primary' : 'secondary'}`} aria-pressed={repro ? reproStructs : undefined} disabled={running} onClick={loadStructures} aria-label={repro ? `구조물 의심 가로선 ${presetIds.length}개 불러오기` : '기존 사업지 구조물 구간 불러오기'}><Import size={16} aria-hidden="true" />{repro ? `구조물 ${presetIds.length}개 불러오기` : '기존 구조물 불러오기'}</button>}
            {polys.length > 0 && <button type="button" className="krds-btn small secondary" onClick={() => { setPolys([]); setRing([]); setReproStructs(false) }}><Trash2 size={16} aria-hidden="true" />{repro ? '구조물 지우기' : `구조물 ${polys.length}개 지우기`}</button>}
          </div>
        </div>
        <div className="cs-col">
          <Box title="분석 조건">
            <div className="cs-form">
              {reproSites.length > 0 && <Field label="분석 방식"><Segmented label="분석 방식" value={mode} options={MODES} onChange={chooseMode} disabled={running} /></Field>}
              {repro ? (
                <>
                  <Field label="사업지 목록"><Pick label="사업지 목록" value={preset} options={reproSites.map((s) => [s.id, s.name])} onChange={(id) => choosePreset(id)} disabled={running} wide /></Field>
                  <dl className="cs-kv is-row">
                    <div><dt>장면</dt><dd>{reproDates.join(', ') || '불러오는 중'}</dd></div>
                    <div><dt>가로선</dt><dd>{reproRows ? `${reproRows.length}개, ${reproSite?.repro.spacingM} m 간격` : '불러오는 중'}</dd></div>
                    <div><dt>구조물 의심</dt><dd>{reproStructIds.length ? `${reproStructIds.length}개(${reproStructIds.join(', ')}번)` : '없음'}</dd></div>
                    <div><dt>보류 기준</dt><dd>{rules?.data?.site_rules?.[preset]?.holdThresholdM ?? ''} m</dd></div>
                  </dl>
                  <p className="cs-repro-note">현황판 {reproSite?.name}과 같은 장면과 가로선으로 위성 영상을 다시 읽어 계산합니다.</p>
                  <Field label="이름" htmlFor="an-name"><input id="an-name" className="cs-input" value={name} disabled={running} onChange={(e) => setName(e.target.value)} /></Field>
                  <div className="cs-form-actions">
                    {running
                      ? <button type="button" className="krds-btn medium secondary" onClick={onStop}><Square size={16} aria-hidden="true" />중지</button>
                      : <button type="button" className="krds-btn medium primary" disabled={!reproOk} onClick={() => run()}><Play size={16} aria-hidden="true" />재현 기준으로 실행</button>}
                  </div>
                </>
              ) : (
              <>
              <Field label="사업지 목록"><Pick label="사업지 목록" value={preset} options={[['', '지도에서 고른 점'], ...presets.map((s) => [s.id, s.name])]} onChange={choosePreset} disabled={running} wide /></Field>
              <div className="cs-form-row">
                <Field label="위도" htmlFor="an-lat"><input id="an-lat" className="cs-input" inputMode="decimal" value={lat} disabled={running} aria-invalid={!posOk} onChange={(e) => { setLat(e.target.value); setPreset('') }} /></Field>
                <Field label="경도" htmlFor="an-lon"><input id="an-lon" className="cs-input" inputMode="decimal" value={lon} disabled={running} aria-invalid={!posOk} onChange={(e) => { setLon(e.target.value); setPreset('') }} /></Field>
              </div>
              <div className="cs-form-row">
                <Field label="사업 전 연도"><Pick label="사업 전 연도" value={beforeYear} options={YEARS} onChange={setBefore} disabled={running} /></Field>
                <Field label="사업 후 연도"><Pick label="사업 후 연도" value={afterYear} options={YEARS} onChange={setAfter} disabled={running} /></Field>
              </div>
              <Field label="계절"><Segmented label="계절" value={season} options={SEASONS.map(([k, l]) => [k, l])} onChange={setSeason} disabled={running} /></Field>
              <div className="cs-form-row">
                <Field label="가로선 간격"><Pick label="가로선 간격" value={spacing} options={SPACING} onChange={setSpacing} disabled={running} /></Field>
                <Field label="이름" htmlFor="an-name"><input id="an-name" className="cs-input" value={name} disabled={running} onChange={(e) => setName(e.target.value)} /></Field>
              </div>
              {!yearsOk && <p className="cs-inline-error" role="alert">사업 후 연도를 사업 전 연도보다 뒤로 고릅니다.</p>}
              {!posOk && <p className="cs-inline-error" role="alert">위도와 경도를 숫자로 넣습니다.</p>}
              <div className="cs-form-actions">
                {running
                  ? <button type="button" className="krds-btn medium secondary" onClick={onStop}><Square size={16} aria-hidden="true" />중지</button>
                  : <button type="button" className="krds-btn medium primary" disabled={!canRun} onClick={() => run()}><Play size={16} aria-hidden="true" />분석 실행</button>}
              </div>
              </>
              )}
            </div>
          </Box>
          <Box title="진행" sub={job?.name || ''} flush>
            <ol className="cs-steps" aria-live="polite">
              {stages.map((s, i) => {
                const st = stageState(i)
                const cur = job && job.stage === i && st === 'now'
                return (
                  <li key={s} className={`is-${st}`}>
                    <span className="cs-step-icon" aria-hidden="true">{st === 'done' ? <Check size={16} /> : st === 'now' ? <LoaderCircle size={16} className="cs-spin" /> : <Circle size={16} />}</span>
                    <span className="cs-step-name">{s}</span>
                    <span className="cs-step-count cs-num">{st === 'done' ? '완료' : cur ? `${job.done}/${job.total}` : st === 'fail' ? '중단' : ''}</span>
                  </li>
                )
              })}
            </ol>
            {job?.status === 'error' && (
              <div className="cs-fail">
                <ErrorLine>{job.message || FAIL[job.kind]}</ErrorLine>
                <div className="cs-box-actions">
                  {!jobRepro && others.map(([k, l]) => <button key={k} type="button" className="krds-btn small secondary" onClick={() => run({ season: k })}>{l}으로 다시 실행</button>)}
                </div>
              </div>
            )}
            {resData?.status === 'ready' && (
              <div className="cs-result">
                {resLine && <ul className="cs-run-cond" aria-label="재현 조건">{resLine.map(([k, v]) => <li key={k}><b>{k}</b>{v}</li>)}</ul>}
                {diffLine && <p className="cs-repro-note cs-repro-diff">{diffLine}</p>}
                <ul className="cs-counts" aria-label="분석 결과">
                  <li><strong>{resData.summary.total}</strong>가로선</li>
                  <li><strong>{resData.summary.judgeable}</strong>변화 확인</li>
                  <li><strong>{resData.summary.held}</strong>정규 측량 일정</li>
                  <li><strong>{resData.summary.excluded}</strong>구조물 의심</li>
                  <li><strong>{resData.scenes.length}</strong>장면</li>
                  <li><strong>{job.meta.seconds}</strong>초</li>
                  <li><strong>{(job.meta.bytes / 1048576).toFixed(1)}</strong>MB</li>
                </ul>
                <div className="cs-box-actions">
                  <button type="button" className="krds-btn small primary" onClick={() => onOpen(job.id, 'card')}>판정 카드</button>
                  <button type="button" className="krds-btn small secondary" onClick={() => onOpen(job.id, 'map')}>해안선 지도</button>
                  <button type="button" className="krds-btn small secondary" onClick={() => onOpen(job.id, 'compare')}>전후 영상</button>
                  <button type="button" className="krds-btn small secondary" onClick={() => onOpen(job.id, 'history')}>분석 기록</button>
                </div>
              </div>
            )}
          </Box>
        </div>
      </div>
    </>
  )
}
