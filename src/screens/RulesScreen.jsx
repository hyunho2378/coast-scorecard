// 운영 기준. 보류 기준과 장면 규칙, 별표 10 계산기 입력. 값을 바꾸면 모든 사업지 판정과 점수를 바로 다시 센다
import { Box, Field, PageHead, Pick, Segmented, TableWrap, signed } from '../ui/index.jsx'
import { scoresSite, thresholdOf } from '../lib/judge.js'
import { annexScore, gradeWith, tideShift } from '../lib/annex.js'

const pt = (v) => (typeof v === 'number' ? `${v.toFixed(1)}점` : '')
const share = (v) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '')

function NumInput({ id, value, onChange, step = 1, min, max }) {
  const clamp = (v) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
  return (
    <div className="cs-stepper">
      <button type="button" className="cs-iconbtn" aria-label="줄이기" onClick={() => onChange(clamp(Math.round((value - step) * 1000) / 1000))}>-</button>
      <input id={id} className="cs-input cs-num" inputMode="decimal" value={value} onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) onChange(clamp(v)) }} />
      <button type="button" className="cs-iconbtn" aria-label="늘리기" onClick={() => onChange(clamp(Math.round((value + step) * 1000) / 1000))}>+</button>
    </div>
  )
}

export default function RulesScreen({ sites, siteData, rules, settings, setSettings, siteId, onSite }) {
  const set = (k) => (v) => setSettings((s) => ({ ...s, [k]: v }))
  const korea = rules?.data?.site_rules?.banam
  const scored = sites.filter((s) => scoresSite(rules?.data?.site_rules?.[s.id]) && siteData[s.id]?.status === 'ready')
  const cur = scored.find((s) => s.id === siteId) || scored[0]
  const d = cur ? siteData[cur.id] : null
  const sc = d ? annexScore(d.rows, settings) : null
  const shift = tideShift(settings.tide, settings.slope)
  const thr = thresholdOf(rules?.data?.site_rules?.[cur?.id], settings.basis)

  return (
    <>
      <PageHead title="운영 기준" meta={<><span>보류 기준 {settings.basis === 'p95' ? `${korea?.p95?.threshold_m ?? 44.9} m(엄격)` : `${korea?.holdThresholdM ?? 22.9} m(기본)`}</span><span>시점별 장면 {settings.minScenes}장 이상</span></>} />
      <div className="cs-split is-even">
        <div className="cs-col">
          <Box title="보류 기준">
            <div className="cs-form">
              <Field label="보류 기준"><Segmented label="보류 기준" value={settings.basis} options={[['sd1', `${korea?.holdThresholdM ?? 22.9} m(기본)`], ['p95', `${korea?.p95?.threshold_m ?? 44.9} m(엄격)`]]} onChange={set('basis')} /></Field>
            </div>
          </Box>
          <Box title="장면 규칙">
            <div className="cs-form">
              <div className="cs-form-row">
                <Field label="시점별 최소 장면"><Pick label="시점별 최소 장면" value={settings.minScenes} options={[[1, '1장'], [2, '2장'], [3, '3장']]} onChange={set('minScenes')} /></Field>
                <Field label="시점별 최대 장면"><Pick label="시점별 최대 장면" value={settings.maxScenes} options={[[2, '2장'], [3, '3장'], [4, '4장']]} onChange={set('maxScenes')} /></Field>
              </div>
              <div className="cs-form-row">
                <Field label="장면 구름 상한"><Pick label="장면 구름 상한" value={settings.maxCloud} options={[[5, '5%'], [10, '10%'], [20, '20%']]} onChange={set('maxCloud')} /></Field>
                <Field label="가로선 간격"><Pick label="가로선 간격" value={settings.spacing} options={[[50, '50 m'], [100, '100 m'], [200, '200 m']]} onChange={set('spacing')} /></Field>
              </div>
            </div>
          </Box>
          <Box title="별표 10 계산기" sub="해양수산부 고시 제2025-181호">
            <div className="cs-form">
              <Field label="사업지"><Pick label="계산기 사업지" value={cur?.id} options={scored.map((s) => [s.id, s.name])} onChange={onSite} wide /></Field>
              <div className="cs-form-row">
                <Field label="사업 전 해빈폭" htmlFor="rs-w0" unit="m"><NumInput id="rs-w0" value={settings.w0} onChange={set('w0')} step={5} min={1} max={500} /></Field>
                <Field label="목표 해안선 거리" htmlFor="rs-off" unit="m"><NumInput id="rs-off" value={settings.offset} onChange={set('offset')} step={5} min={-100} max={200} /></Field>
              </div>
              <div className="cs-form-row">
                <Field label="해빈 경사" htmlFor="rs-slope"><NumInput id="rs-slope" value={settings.slope} onChange={set('slope')} step={0.01} min={0.01} max={1} /></Field>
                <Field label="조위 차이" htmlFor="rs-tide" unit="m"><NumInput id="rs-tide" value={settings.tide} onChange={set('tide')} step={0.1} min={0} max={10} /></Field>
              </div>
              <Field label="나머지 항목 점수" htmlFor="rs-other" unit="점"><NumInput id="rs-other" value={settings.other} onChange={set('other')} step={1} min={0} max={40} /></Field>
            </div>
          </Box>
        </div>
        <div className="cs-col">
          <Box title="계산 결과" sub={cur?.name || ''} flush>
            {sc && (
              <TableWrap label="별표 10 계산 결과 표">
                <table className="cs-table">
                  <thead><tr><th>항목</th><th className="is-num">값</th><th className="is-num">점수</th></tr></thead>
                  <tbody>
                    <tr><td>평균 해빈폭</td><td className="is-num">{signed(sc.mean)} / {settings.w0} m</td><td className="is-num"><strong>{pt(sc.beach)}</strong></td></tr>
                    <tr><td>목표해안선 적합도</td><td className="is-num">A {share(sc.a)}, B {share(sc.b)}</td><td className="is-num"><strong>{pt(sc.fit)}</strong></td></tr>
                    <tr><td>위성 두 항목 합</td><td className="is-num">최대 60점</td><td className="is-num"><strong>{pt(sc.sum)}</strong></td></tr>
                    <tr><td>나머지 항목</td><td className="is-num">최대 40점</td><td className="is-num">{pt(settings.other)}</td></tr>
                    <tr className="is-current"><td>등급</td><td className="is-num">{pt(typeof sc.sum === 'number' ? sc.sum + settings.other : null)}</td><td className="is-num"><strong>{gradeWith(sc.sum, settings.other) || ''}</strong></td></tr>
                    <tr><td>조위 수평 환산</td><td className="is-num">{settings.tide} m / {settings.slope}</td><td className="is-num">{shift === null ? '' : `${shift} m`}</td></tr>
                    <tr><td>보류 기준</td><td className="is-num" colSpan={2}>{thr ?? ''} m</td></tr>
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Box>
        </div>
      </div>
      <Box title="사업지별 점수" flush>
            <TableWrap label="사업지별 별표 10 점수 표">
              <table className="cs-table">
                <thead><tr><th>사업지</th><th className="is-num">변화 확인</th><th className="is-num">구간 평균</th><th className="is-num">해빈폭 점수</th><th className="is-num is-wrap"><span className="rb-phrase">목표해안선</span> <span className="rb-phrase">적합도</span></th><th className="is-num is-wrap"><span className="rb-phrase">위성 두 항목</span> <span className="rb-phrase">합</span></th></tr></thead>
                <tbody>
                  {scored.map((s) => {
                    const x = annexScore(siteData[s.id].rows, settings)
                    return (
                      <tr key={s.id} className={s.id === cur?.id ? 'is-current' : undefined}>
                        <td><button type="button" className="cs-rowlink" onClick={() => onSite(s.id)}>{s.name}</button></td>
                        <td className="is-num">{siteData[s.id].summary.judgeable}</td>
                        <td className="is-num">{signed(x.mean)}</td>
                        <td className="is-num">{pt(x.beach)}</td>
                        <td className="is-num">{pt(x.fit)}</td>
                        <td className="is-num"><strong>{pt(x.sum)}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Box>
    </>
  )
}
