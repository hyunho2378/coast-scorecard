// 문서 센터. 선택한 사업지의 내려받기 파일과 인쇄용 판정 부록. 파일은 Blob 으로만 만든다
import { Download, Printer } from 'lucide-react'
import { PageHead, SiteState, TableWrap, signed } from '../ui/index.jsx'
import { downloadText, surveyCsv, surveyFileName, surveyRows } from '../lib/survey.js'
import { ledgerText, fmtDate } from '../lib/ledger.js'
import { appendixCsv, appendixRows, shorelinesGeojson, stamp, transectsGeojson, verdictText } from '../lib/docs.js'
import { annexScore } from '../lib/annex.js'
import { thresholdOf } from '../lib/judge.js'
import { SiteTabs } from './HomeScreen.jsx'

export default function DocsScreen({ sites, siteData, rules, settings, site, onSite }) {
  const data = siteData[site.id]
  const ready = data?.status === 'ready'
  const today = stamp()
  const list = sites.map((s) => ({ site: s, data: siteData[s.id] })).filter((x) => x.data?.status === 'ready')
  const head = <PageHead title="문서 센터" meta={<><span>{site.name}</span>{typeof thresholdOf(rules?.data?.site_rules?.[site.id], settings.basis) === 'number' && <span>보류 기준 {thresholdOf(rules?.data?.site_rules?.[site.id], settings.basis)}{'\u00a0'}m</span>}</>} actions={<button type="button" className="krds-btn small primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />판정 부록 인쇄</button>} />
  if (!ready) return <>{head}<SiteTabs sites={sites} siteData={siteData} siteId={site.id} onSelect={onSite} /><SiteState data={data} /></>

  const ledger = ledgerText({ site, rows: data.rows, period: data.period, today })
  const geoT = transectsGeojson(site, data.rows)
  const geoS = shorelinesGeojson(site, data.scenes)
  const files = [
    ['현장 측량 구간', 'CSV', surveyRows(data.rows).length, () => downloadText(surveyCsv({ site, rows: data.rows, baseScene: data.scenes[0] }), surveyFileName(site, today))],
    ['가로선', 'GeoJSON', data.rows.length, () => downloadText(geoT, `${site.id}_가로선_${today}.geojson`, 'application/geo+json')],
    ['해안선', 'GeoJSON', data.scenes.length, () => downloadText(geoS, `${site.id}_해안선_${today}.geojson`, 'application/geo+json')],
    ['사업지별 판정 부록 표', 'CSV', appendixRows(list).length, () => downloadText(appendixCsv(list), `판정부록_${today}.csv`)],
    ['대장 옮김 문구', 'TXT', ledger ? ledger.split('\n').length : 0, () => downloadText('\uFEFF' + ledger.replace(/\n/g, '\r\n') + '\r\n', `${site.id}_대장문구_${today}.txt`, 'text/plain;charset=utf-8')]
  ]

  return (
    <>
      {head}
      <SiteTabs sites={sites} siteData={siteData} siteId={site.id} onSelect={onSite} />
      <section className="cs-noprint" aria-label="내려받기 파일">
        <TableWrap label="내려받기 파일 표">
          <table className="cs-table">
            <thead><tr><th>문서</th><th>형식</th><th className="is-num">행</th><th><span className="sr-only">내려받기</span></th></tr></thead>
            <tbody>
              {files.map(([name, kind, n, fn]) => (
                <tr key={name}>
                  <td>{name}</td><td>{kind}</td><td className="is-num">{n}</td>
                  <td><button type="button" className="krds-btn small secondary" disabled={!n} onClick={fn}><Download size={16} aria-hidden="true" />내려받기</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </section>

      <section className="cs-print-area" aria-label="판정 부록">
        <h2 className="cs-section-title">판정 부록 <span className="cs-sub">{fmtDate(today)} 작성</span></h2>
        <TableWrap label="사업지별 판정 요약 표">
          <table className="cs-table">
            <thead><tr><th>사업지</th><th className="is-num">가로선</th><th className="is-num is-wrap">변화 확인</th><th className="is-num is-wrap">구조물 의심</th><th className="is-num is-wrap">정규 측량 일정</th><th className="is-num">구간 평균</th><th className="is-num">위성 두 항목</th></tr></thead>
            <tbody>
              {list.map(({ site: s, data: d }) => {
                const a = annexScore(d.rows, settings)
                return <tr key={s.id}><td>{s.name}</td><td className="is-num">{d.summary.total}</td><td className="is-num"><strong>{d.summary.judgeable}</strong></td><td className="is-num">{d.summary.excluded}</td><td className="is-num">{d.summary.held}</td><td className="is-num">{signed(d.summary.sectionMean)}</td><td className="is-num">{typeof a.sum === 'number' ? `${a.sum}점` : ''}</td></tr>
              })}
            </tbody>
          </table>
        </TableWrap>
        <h3 className="cs-section-title">{site.name} 가로선</h3>
        <TableWrap label={`${site.name} 가로선 판정 표`}>
          <table className="cs-table">
            <thead><tr><th className="is-num">가로선</th><th className="is-num">이동 거리</th><th className="is-num">보류 기준</th><th>판정</th></tr></thead>
            <tbody>{data.rows.map((r) => <tr key={r.id}><td className="is-num">{r.id}</td><td className="is-num">{signed(r.change)}</td><td className="is-num">{r.threshold ?? ''} m</td><td>{verdictText(r.verdict)}</td></tr>)}</tbody>
          </table>
        </TableWrap>
        <p className="cs-print-foot">Contains modified Copernicus Sentinel data, 지도 자료 OpenStreetMap 기여자</p>
      </section>
    </>
  )
}
