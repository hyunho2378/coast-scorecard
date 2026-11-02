// 사업지 목록. GitHub 저장소 목록처럼 한 줄에 한 사업지
import { Box, Empty, ErrorLine, PageHead, pct } from '../ui/index.jsx'
import { fmtDate } from '../lib/ledger.js'

function Cells({ d }) {
  if (!d || d.status === 'loading') return <td colSpan={5}><span className="cs-skel" style={{ width: 'calc(var(--krds-number-21) * 2)' }} aria-label="불러오는 중" /></td>
  if (d.status === 'error') return <td colSpan={5} className="cs-verdict is-retreat">분석 파일을 읽지 못했습니다.</td>
  if (d.status === 'empty') return <td colSpan={5} className="is-sub">해안선 파일 없음</td>
  const s = d.summary
  return (
    <>
      <td className="is-num">{s.total}</td>
      <td className="is-num">{s.judgeable}<span className="is-sub"> {pct(s.judgeableRatio)}</span></td>
      <td className="is-num">{s.held}</td>
      <td className="is-num">{s.thresholds[0]}{'\u00a0'}m</td>
      <td className="is-num">{fmtDate(d.period.from)}부터 {fmtDate(d.period.to)}까지</td>
    </>
  )
}

export default function SitesScreen({ sites, siteData, onOpen }) {
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready')
  const total = ready.reduce((a, s) => a + siteData[s.id].summary.total, 0)
  return (
    <>
      <PageHead title="사업지 목록" meta={<><span>사업지 {sites.length}곳</span>{ready.length > 0 && <span>가로선 {total}개</span>}</>} />
      <Box flush>
        {sites.length ? (
          <div className="cs-table-wrap">
            <table className="cs-table">
              <thead><tr><th>사업지</th><th>사업 내용</th><th className="is-num">가로선</th><th className="is-num">판정 가능</th><th className="is-num">판정 보류</th><th className="is-num">보류 기준</th><th className="is-num">비교 기간</th></tr></thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <button type="button" className="cs-rowlink" onClick={() => onOpen(s.id)}>{s.name}</button>
                      <span className="is-sub"> {s.region}, {s.country}</span>
                    </td>
                    <td className="is-sub">{s.kind}</td>
                    <Cells d={siteData[s.id]} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>연결한 사업지가 없습니다.</Empty>}
      </Box>
    </>
  )
}
