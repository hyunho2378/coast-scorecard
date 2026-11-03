// 사업지 목록. GitHub 저장소 목록처럼 한 줄에 한 사업지
import { Box, Empty, ErrorLine, PageHead, TableWrap, pct } from '../ui/index.jsx'
import { nextCandidates } from '../lib/loader-core.js'
import { fmtDate } from '../lib/ledger.js'
import { ROLE, roleOf } from '../lib/judge.js'

function Cells({ d }) {
  if (!d || d.status === 'loading') return <td colSpan={6}><span className="cs-skel" style={{ width: 'calc(var(--krds-number-21) * 2)' }} aria-label="불러오는 중" /></td>
  if (d.status === 'error') return <td colSpan={6} className="cs-verdict is-retreat">분석 파일을 읽지 못했습니다.</td>
  if (d.status === 'empty') return <td colSpan={6} className="is-sub">해안선 파일 없음</td>
  const s = d.summary
  return (
    <>
      <td className="is-num">{s.total}</td>
      <td className="is-num">{s.judgeable}<span className="is-sub"> {pct(s.judgeableRatio)}</span></td>
      <td className="is-num">{s.held}</td>
      <td className="is-num">{s.excluded || 0}</td>
      <td className="is-num">{s.thresholds[0]}{'\u00a0'}m</td>
      <td className="is-num is-wrap"><span className="rb-phrase">{fmtDate(d.period.from)}부터</span> <span className="rb-phrase">{fmtDate(d.period.to)}까지</span></td>
    </>
  )
}

export default function SitesScreen({ sites, siteData, rules, onOpen }) {
  const roleFor = (id) => roleOf(rules?.data?.site_rules?.[id])
  const byRole = Object.keys(ROLE).map((k) => [k, sites.filter((x) => roleFor(x.id) === k).length]).filter(([, n]) => n > 0)
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready')
  const total = ready.reduce((a, s) => a + siteData[s.id].summary.total, 0)
  const cands = nextCandidates(rules?.data)
  return (
    <>
      <PageHead title="사업지 목록" meta={<>{byRole.map(([k, n]) => <span key={k}>{ROLE[k]} {n}곳</span>)}{cands.length > 0 && <span>다음 적용 후보 {cands.length}곳</span>}{ready.length > 0 && <span>가로선 {total}개</span>}</>} />
      <Box flush>
        {sites.length ? (
          <TableWrap label="사업지 표">
            <table className="cs-table">
              <thead><tr><th>사업지</th><th>구분</th><th>사업 내용</th><th className="is-num">가로선</th><th className="is-num">판정 가능</th><th className="is-num">판정 보류</th><th className="is-num is-wrap">구조물 의심 제외</th><th className="is-num">보류 기준</th><th className="is-num">비교 기간</th></tr></thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <button type="button" className="cs-rowlink" onClick={() => onOpen(s.id)}>{s.name}</button>
                      <span className="is-sub cs-block">{s.region}, {s.country}</span>
                    </td>
                    <td><span className={`cs-role is-${roleFor(s.id)}`}>{ROLE[roleFor(s.id)]}</span></td>
                    <td className="is-sub is-wrap is-kind">{s.kind}</td>
                    <Cells d={siteData[s.id]} />
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : <Empty>연결한 사업지가 없습니다.</Empty>}
      </Box>
      {cands.length > 0 && (
        <Box title="다음 적용 후보" sub="효과평가 법정 대상 사업비 200억 원 이상" flush foot={<><span className="rb-phrase">해양수산부 연안정비 사업정보에서 고른 동해안 사업지구입니다.</span> <span className="rb-phrase">위성 전후 비교는 다음 순서로 진행합니다.</span></>}>
          <TableWrap label="다음 적용 후보 표">
            <table className="cs-table">
              <thead><tr><th>사업지구</th><th>사업 내용</th><th className="is-num">사업비</th><th className="is-num">착공</th><th className="is-num">완료</th></tr></thead>
              <tbody>
                {cands.map((c) => (
                  <tr key={c.no}>
                    <td>{c.name}<span className="is-sub cs-block">다음 적용 후보</span></td>
                    <td className="is-sub is-wrap is-kind">{c.content}</td>
                    <td className="is-num">약 {c.eok}억 원</td>
                    <td className="is-num">{fmtDate(c.construct)}</td>
                    <td className="is-num">{fmtDate(c.done)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Box>
      )}
    </>
  )
}
