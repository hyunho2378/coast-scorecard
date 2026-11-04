// 판정 카드. 사후관리대장에 옮길 한 장. 탭 셋: 판정(큰 숫자, 가로선 목록, 선택 상세, 대장 문구), 별표 10 점수, 상세(오차 유형별 점수 변동)
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Note, PageHead, SiteState, TableWrap, signed, pct } from '../ui/index.jsx'
import { ledgerText, fmtDate } from '../lib/ledger.js'
import { downloadText, surveyCsv, surveyFileName } from '../lib/survey.js'
import { conditionsCsvHead, runConditions, runLine } from '../lib/runs.js'
import { projectFactsFor, unifiedFor } from '../lib/loader-core.js'
import { beachWidthScore, roleOf, ROLE } from '../lib/judge.js'
import { annexScore, gradeWith } from '../lib/annex.js'
import { stamp } from '../lib/docs.js'
import { BigNumbers, TransectDetail, TransectList, listOrder } from '../parts/transect.jsx'

const pt = (v) => (typeof v === 'number' ? v.toFixed(2) : '')
const two = (v) => (typeof v === 'number' ? (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2)) : '')
const sc = (v) => (typeof v === 'number' ? `${v.toFixed(1)}점` : '')
const TABS = [['judge', '판정'], ['score', '별표 10 점수'], ['detail', '상세']]

export function Tabs({ value, onChange, label, items }) {
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const n = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]
    onChange(n[0]); e.preventDefault()
    e.currentTarget.parentElement.querySelectorAll('[role="tab"]')[items.indexOf(n)]?.focus()
  }
  return (
    <div className="cs-tabs" role="tablist" aria-label={label}>
      {items.map(([k, l], i) => (
        <button key={k} type="button" role="tab" id={`tab-${k}`} aria-controls={`panel-${k}`} aria-selected={value === k} tabIndex={value === k ? 0 : -1} onKeyDown={(e) => onKey(e, i)} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  )
}

export default function CardScreen({ site, data, rules, settings, onRetry }) {
  const [tab, setTab] = useState('judge')
  const [copied, setCopied] = useState(false)
  const areaRef = useRef(null)
  const ready = data?.status === 'ready'
  const first = useMemo(() => (ready ? listOrder(data.rows)[0]?.id ?? null : null), [ready, data])
  const [sel, setSel] = useState(first)
  useEffect(() => { setSel(first) }, [first])
  const today = stamp()
  if (!ready) return <><PageHead title={`${site.name} 판정 카드`} /><SiteState data={data} onRetry={onRetry} /></>

  const s = data.summary
  const rows = data.rows
  const rule = rules?.data?.site_rules?.[site.id]
  const role = site.run ? 'project' : roleOf(rule)
  const text = ledgerText({ site, rows, period: data.period, today })
  const unified = role === 'control' ? null : unifiedFor(rules?.data, site.id)
  const facts = projectFactsFor(rules?.data, site.id)
  const score = annexScore(rows, settings)
  const row = rows.find((r) => r.id === sel)
  const thr = s.thresholds[0]
  const runInfo = site.run && data.run ? { data, rule } : null
  const download = () => downloadText(surveyCsv({ site, rows, baseScene: data.scenes[0], head: runInfo ? conditionsCsvHead(runConditions(runInfo)) : [] }), surveyFileName(site, today))
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { areaRef.current?.select(); document.execCommand?.('copy') }
    setCopied(true); setTimeout(() => setCopied(false), 2400)
  }

  return (
    <>
      <PageHead title={`${site.name} 판정 카드`}
        meta={<><span>{site.run ? '새 분석' : ROLE[role]}</span><span>{fmtDate(data.period.from)}부터 {fmtDate(data.period.to)}까지</span><span>보류 기준 {thr}{'\u00a0'}m</span>{s.sectionN > 0 && <span>구간 평균 {signed(s.sectionMean)}</span>}</>}
        actions={<button type="button" className="krds-btn small primary" onClick={download}><Download size={16} aria-hidden="true" />현장 측량 구간 CSV</button>} />
      {runInfo && <ul className="cs-run-cond cs-card-cond" aria-label="재현 조건">{runLine(runInfo).map(([k, v]) => <li key={k}><b>{k}</b>{v}</li>)}</ul>}
      <BigNumbers summary={s} />
      <Tabs value={tab} onChange={setTab} label="판정 카드 보기" items={TABS} />

      {tab === 'judge' && (
        <div id="panel-judge" role="tabpanel" aria-labelledby="tab-judge" className="cs-dash is-card">
          <section className="cs-dash-list" aria-label="가로선 목록">
            <TransectList rows={rows} selected={sel} onSelect={setSel} />
          </section>
          <aside className="cs-dash-side">
            <TransectDetail row={row} settings={settings} />
            <section className="cs-ledger-wrap" aria-label="대장 옮김 문구">
              <div className="cs-section-head">
                <h2 className="cs-section-title">대장 옮김 문구</h2>
                {text && <button type="button" className="krds-btn small secondary" onClick={copy}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? '복사 완료' : '복사'}</button>}
              </div>
              {text ? <><label htmlFor="ledger" className="sr-only">대장 옮김 문구</label><textarea id="ledger" ref={areaRef} readOnly value={text} rows={Math.min(10, text.split('\n').length + 1)} className="cs-ledger" /></> : <p className="cs-state">변화 확인 구간 없음</p>}
              <p role="status" className="sr-only">{copied ? '문구 복사 완료' : ''}</p>
            </section>
          </aside>
        </div>
      )}

      {tab === 'score' && (
        <div id="panel-score" role="tabpanel" aria-labelledby="tab-score" className="cs-split is-even">
          <section aria-label="별표 10 점수">
            <TableWrap label="별표 10 점수 표">
              <table className="cs-table">
                <thead><tr><th>항목</th><th className="is-num">값</th><th className="is-num">점수</th></tr></thead>
                <tbody>
                  <tr><td>평균 해빈폭</td><td className="is-num">{signed(score.mean)} / {settings.w0} m</td><td className="is-num"><strong>{sc(score.beach)}</strong></td></tr>
                  <tr><td>목표해안선 적합도</td><td className="is-num">목표선 {settings.offset} m, B {typeof score.b === 'number' ? pct(score.b) : ''}</td><td className="is-num"><strong>{sc(score.fit)}</strong></td></tr>
                  <tr><td>위성 두 항목 합</td><td className="is-num">최대 60점</td><td className="is-num"><strong>{sc(score.sum)}</strong></td></tr>
                  <tr className="is-current"><td>등급</td><td className="is-num">나머지 {settings.other}점 포함</td><td className="is-num"><strong>{gradeWith(score.sum, settings.other) || ''}</strong></td></tr>
                </tbody>
              </table>
            </TableWrap>
            <Note>위성 값 기준 참고 점수, 현장 측량값 입력 시 확정 점수로 바뀜</Note>
          </section>
          <section aria-label="사업 전 해빈폭별 점수">
            <TableWrap label="사업 전 해빈폭별 점수 표">
              <table className="cs-table">
                <thead><tr><th>사업 전 해빈폭</th><th className="is-num">구간 평균</th><th className="is-num">해빈폭 점수</th></tr></thead>
                <tbody>
                  {[...new Set([20, 30, 50, 100, settings.w0])].sort((a, b) => a - b).map((w0) => (
                    <tr key={w0} className={w0 === settings.w0 ? 'is-current' : undefined}><td className="cs-num">{w0}{'\u00a0'}m</td><td className="is-num">{signed(s.sectionMean)}</td><td className="is-num">{sc(beachWidthScore(w0, s.sectionMean))}</td></tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </section>
        </div>
      )}

      {tab === 'detail' && (
        <div id="panel-detail" role="tabpanel" aria-labelledby="tab-detail" className="cs-col">
          {unified && (
            <section aria-label="오차 유형별 점수 변동">
              <h2 className="cs-section-title">오차 유형별 점수 변동 <span className="cs-sub">위성 위치 오차 {unified.errorM}{'\u00a0'}m</span></h2>
              <TableWrap label="오차 유형별 점수 변동 표">
                <table className="cs-table is-grouped">
                  <thead>
                    <tr><th rowSpan={2}>오차 유형</th><th colSpan={2} className="is-group">해빈폭</th><th colSpan={2} className="is-group">적합도</th><th colSpan={2} className="is-group">상관</th><th colSpan={2} className="is-group">합계</th></tr>
                    <tr>{Array.from({ length: 4 }, (_, i) => [<th key={`a${i}`} className="is-num">상하한 전</th>, <th key={`b${i}`} className="is-num">후</th>])}</tr>
                  </thead>
                  <tbody>
                    {unified.rows.map((r) => (
                      <tr key={r.mode}>
                        <td className="is-wrap">{r.label}</td>
                        <td className="is-num">{pt(r.beachWidth[0])}</td><td className="is-num">{pt(r.beachWidth[1])}</td>
                        <td className="is-num">{pt(r.fit[0])}</td><td className="is-num">{pt(r.fit[1])}</td>
                        <td className="is-num">{two(r.corr[0])}</td><td className="is-num">{two(r.corr[1])}</td>
                        <td className="is-num">{pt(r.total[0])}</td><td className="is-num"><strong>{pt(r.total[1])}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          )}
          <section aria-label="사업 정보">
            <h2 className="cs-section-title">사업 정보</h2>
            <dl className="cs-detail-kv is-wide">
              <div><dt>사업 내용</dt><dd>{site.kind}</dd></div>
              {facts && <div><dt>사업비</dt><dd>약 {facts.eok}억 원</dd></div>}
              <div><dt>구조물 의심 가로선</dt><dd className="cs-num">{rows.filter((r) => r.verdict === 'struct').map((r) => r.id).join(', ') || '없음'}</dd></div>
              <div><dt>장면</dt><dd className="cs-num">{data.scenes.map((x) => fmtDate(x.date)).join(', ')}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </>
  )
}
