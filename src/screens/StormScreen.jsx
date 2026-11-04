// 점검 순서 목록. 기준 장면과 비교 장면 사이 변화 확인 가로선만 모아 변화가 큰 순서로. 점검 표시와 메모는 화면 안 상태로만 둔다
import { useMemo } from 'react'
import { Box, Empty, Loading, PageHead, TableWrap, Verdict, signed } from '../ui/index.jsx'
import { stormOrder } from '../lib/judge.js'
import { checkKey } from '../lib/checks.js'

export default function StormScreen({ sites, siteData, checks, setChecks, onOpen }) {
  const loading = sites.some((s) => (siteData[s.id]?.status || 'loading') === 'loading')
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready')
  const list = useMemo(() => stormOrder(ready.map((s) => ({ ...s, rows: siteData[s.id].rows }))), [siteData]) // eslint-disable-line react-hooks/exhaustive-deps
  const heldTotal = ready.reduce((a, s) => a + siteData[s.id].summary.held, 0)
  const exclTotal = ready.reduce((a, s) => a + (siteData[s.id].summary.excluded || 0), 0)
  const done = list.filter((r) => checks[checkKey(r.siteId, r.id)]?.done).length
  const set = (k, patch) => setChecks((m) => ({ ...m, [k]: { ...m[k], ...patch } }))

  return (
    <>
      <PageHead title="점검 순서 목록" meta={<><span>변화 확인 구간 {list.length}개</span><span>점검 완료 {done}개</span><span>정규 측량 일정 구간 {heldTotal}개 제외</span>{exclTotal > 0 && <span>구조물 의심 구간 {exclTotal}개 제외</span>}</>} />
      <Box flush>
        {loading ? <Loading rows={6} /> : !list.length ? <Empty>변화 확인 구간 없음</Empty> : (
          <TableWrap label="점검 순서 표">
            <table className="cs-table">
              <thead><tr><th>순서</th><th>완료</th><th>사업지</th><th className="is-num">가로선</th><th className="is-num">변화</th><th>판정</th><th>현장 메모</th></tr></thead>
              <tbody>
                {list.map((r, i) => {
                  const k = checkKey(r.siteId, r.id)
                  const c = checks[k] || {}
                  const id = `chk-${k.replace(':', '-')}`
                  return (
                    <tr key={k} className={c.done ? 'is-done' : undefined}>
                      <td className="cs-num">{i + 1}</td>
                      <td>
                        <div className="krds-form-check">
                          <input type="checkbox" id={id} checked={Boolean(c.done)} onChange={(e) => set(k, { done: e.target.checked })} />
                          <label htmlFor={id}><span className="sr-only">{r.siteName} 가로선 {r.id} 점검 완료</span></label>
                        </div>
                      </td>
                      <td><button type="button" className="cs-rowlink" onClick={() => onOpen(r.siteId)}>{r.siteName}</button></td>
                      <td className="is-num">{r.id}</td>
                      <td className="is-num">{signed(r.change)}</td>
                      <td><Verdict v={r.verdict} /></td>
                      <td style={{ minWidth: 'calc(var(--krds-number-21) * 2)' }}>
                        <label htmlFor={`memo-${id}`} className="sr-only">{r.siteName} 가로선 {r.id} 현장 메모</label>
                        <input id={`memo-${id}`} type="text" className="cs-input" value={c.memo || ''} onChange={(e) => set(k, { memo: e.target.value })} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Box>
    </>
  )
}
