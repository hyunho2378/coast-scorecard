// 분석 기록. 이 브라우저 화면 안에서 돌린 새 분석 목록. 결과는 메모리에만 있고 파일로 내려받거나 다시 불러온다
import { useRef, useState } from 'react'
import { Download, FolderOpen, Trash2 } from 'lucide-react'
import { Box, Empty, ErrorLine, PageHead, TableWrap } from '../ui/index.jsx'
import { downloadText } from '../lib/survey.js'
import { parseRunFile, runFile } from '../lib/runs.js'
import { stamp } from '../lib/docs.js'

export default function HistoryScreen({ runs, siteData, onOpen, onRemove, onAdd }) {
  const input = useRef(null)
  const [err, setErr] = useState(null)
  const load = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { const id = onAdd(parseRunFile(await f.text())); setErr(null); onOpen(id, 'history') } catch (x) { setErr(String(x.message || x)) }
  }
  return (
    <>
      <PageHead title="분석 기록" meta={<span>새 분석 {runs.length}건</span>} actions={<>
        <button type="button" className="krds-btn small secondary" onClick={() => input.current?.click()}><FolderOpen size={16} aria-hidden="true" />결과 파일 불러오기</button>
        <input ref={input} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={load} />
      </>} />
      {err && <Box flush><ErrorLine>{err}</ErrorLine></Box>}
      <Box flush>
        {!runs.length ? <Empty>새 분석 기록 없음</Empty> : (
          <TableWrap label="분석 기록 표">
            <table className="cs-table">
              <thead><tr><th>이름</th><th>위치</th><th>시점</th><th className="is-num">장면</th><th className="is-num">가로선</th><th className="is-num">변화 확인</th><th className="is-num is-wrap">구조물 의심</th><th className="is-num">정규 측량 일정</th><th className="is-num">시간</th><th><span className="sr-only">작업</span></th></tr></thead>
              <tbody>
                {runs.map((r) => {
                  const d = siteData[r.site.id]
                  const s = d?.summary
                  const m = r.data.run?.meta || {}
                  return (
                    <tr key={r.site.id}>
                      <td><button type="button" className="cs-rowlink" onClick={() => onOpen(r.site.id, 'card')}>{r.site.name}</button></td>
                      <td className="cs-num">{r.site.region}</td>
                      <td>{r.site.kind}</td>
                      <td className="is-num">{d?.scenes?.length ?? ''}</td>
                      <td className="is-num">{s?.total ?? ''}</td>
                      <td className="is-num"><strong>{s?.judgeable ?? ''}</strong></td>
                      <td className="is-num">{s?.excluded ?? ''}</td>
                      <td className="is-num">{s?.held ?? ''}</td>
                      <td className="is-num">{typeof m.seconds === 'number' ? `${m.seconds}초` : ''}</td>
                      <td>
                        <div className="cs-rowtools">
                          <button type="button" className="cs-iconbtn" aria-label={`${r.site.name} 결과 파일 내려받기`} onClick={() => downloadText(runFile(r), `${r.site.name.replace(/\s+/g, '_')}_분석결과_${stamp()}.json`, 'application/json')}><Download size={16} aria-hidden="true" /></button>
                          <button type="button" className="cs-iconbtn" aria-label={`${r.site.name} 기록 지우기`} onClick={() => onRemove(r.site.id)}><Trash2 size={16} aria-hidden="true" /></button>
                        </div>
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
