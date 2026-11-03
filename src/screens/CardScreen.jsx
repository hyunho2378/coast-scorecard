// 판정 카드. 담당자가 사후관리대장에 옮겨 적는 한 장(UX 리서치 패키지 9장)
import { useMemo, useRef, useState } from 'react'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { Bar, Box, Button, KV, Note, PageHead, SiteState, TableWrap, Verdict, HOLD_ACTION, RESPONSIBILITY, pct, signed } from '../ui/index.jsx'
import { ledgerText, fmtDate } from '../lib/ledger.js'
import { falsePositiveRows, projectFactsFor, scoreInputsFor, typeRulesFor, unifiedFor } from '../lib/loader-core.js'
import { BASES, beachWidthScore, isJudgeable, roleOf, ROLE } from '../lib/judge.js'

const ANNEX = '해양수산부 고시 제2025-181호 별표 10'
// 구절 단위 줄바꿈(K1): 구절 안에서는 끊지 않는다
const Ph = ({ t }) => t.map((x, i) => <span key={x}>{i > 0 && ' '}<span className="rb-phrase">{x}</span></span>)
const two = (v) => (typeof v === 'number' ? (Object.is(v, -0) || Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2)) : '없음')
const pt = (v) => (typeof v === 'number' ? v.toFixed(2) : '없음')
const pc = (v) => (typeof v === 'number' ? pct(v) : '없음')
// 실태조사 등급을 같은 등급이 이어지는 해끼리 묶는다(2021년 D, 2022년에서 2025년 C)
function gradeRuns(grades, from) {
  const ys = Object.keys(grades || {}).filter((y) => /^\d{4}$/.test(y) && Number(y) >= from).sort()
  const out = []
  for (const y of ys) {
    const last = out[out.length - 1]
    if (last && last.g === grades[y] && Number(last.to) + 1 === Number(y)) last.to = y
    else out.push({ from: y, to: y, g: grades[y] })
  }
  return out.map((r) => (r.from === r.to ? `${r.from}년 ${r.g}` : `${r.from}년에서 ${r.to}년 ${r.g}`)).join(', ')
}

export default function CardScreen({ site, data, rules, basis = 'sd1', onRetry }) {
  const [copied, setCopied] = useState(false)
  const areaRef = useRef(null)
  const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }, [])
  const head = (meta) => <PageHead title={`${site.name} 판정 카드`} meta={meta || <span>{site.region}, {site.country}</span>} />
  if (data?.status !== 'ready') return <>{head()}<SiteState data={data} onRetry={onRetry} /></>

  const s = data.summary
  const rows = data.rows
  const held = rows.filter((r) => !isJudgeable(r.verdict) && r.verdict !== 'struct')
  const text = ledgerText({ site, rows, period: data.period, today })
  const rule = rules?.data?.site_rules?.[site.id]
  const role = roleOf(rule)
  const isControl = role === 'control'
  const unified = isControl ? null : unifiedFor(rules?.data, site.id)
  const inputs = unified ? null : scoreInputsFor(rules?.data, site.id)
  const fitScore = unified ? unified.fitTrue : inputs?.targetFit.find((t) => t.offset === 10)?.score ?? inputs?.targetFit[0]?.score
  const typeRules = typeRulesFor(rules?.data, site.typeRules)
  const facts = projectFactsFor(rules?.data, site.id)
  const excludedRows = rows.filter((r) => r.verdict === 'struct')
  const fp = excludedRows.length ? falsePositiveRows(rules?.data) : []
  const basisLabel = (BASES.find(([k]) => k === basis) || BASES[0])[1]
  const values = rows.map((r) => r.change).filter((v) => typeof v === 'number')
  const grades = rule?.surveyGrades
  const thr = s.thresholds[0]
  const max = Math.max(thr * 2, ...rows.map((r) => Math.abs(r.change ?? 0)), 1)
  const meanDef = <><span className="rb-phrase">가로선 수준 값은 가로선 하나의 전후 이동 거리이고</span> <span className="rb-phrase">구간 평균은 값이 있는 가로선 {s.sectionN}개</span> <span className="rb-phrase">(판정 보류 포함{s.excluded ? `, 구조물 의심 ${s.excluded}개 제외` : ''})의 평균입니다.</span></>

  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { areaRef.current?.select(); document.execCommand?.('copy') }
    setCopied(true); setTimeout(() => setCopied(false), 2400)
  }

  return (
    <>
      {head(<>
        <span>{ROLE[role]}</span>
        <span>{site.region}, {site.country}</span>
        <span>{site.kind}</span>
        <span>{fmtDate(data.period.from)}부터 {fmtDate(data.period.to)}까지</span>
        <span>맑은 장면 {data.scenes.length}장</span>
      </>)}
      <ul className="cs-counts" aria-label="판정 개수">
        <li><strong>{s.total}</strong>가로선</li>
        <li><strong>{s.judgeable}</strong>판정 가능({pct(s.judgeableRatio)})</li>
        <li><strong>{s.held}</strong>판정 보류</li>
        {s.excluded > 0 && <li><strong>{s.excluded}</strong>구조물 의심 제외</li>}
        <li><strong>{s.advance}</strong>전진</li>
        <li><strong>{s.retreat}</strong>후퇴</li>
        <li><strong>{thr}{'\u00a0'}m</strong>보류 기준({basisLabel})</li>
        {s.sectionN > 0 && <li><strong>{signed(s.sectionMean)}</strong>구간 평균</li>}
      </ul>

      <div className="cs-two is-wide-side">
        <div className="cs-col">
          {isControl && (
            <Box title="대조 해변" sub="사업지 점수 계산 없음">
              <p className="cs-text">해양수산부 연안정비 사업정보에 화진포 이름의 사업이 없어 별표 10 점수를 계산하지 않습니다. 사업지 해안선 변화와 견주는 대조 해변으로 씁니다.</p>
              <KV items={[
                values.length > 0 && ['위성 변화', `가로선 ${values.length}개 ${signed(Math.min(...values))}에서 ${signed(Math.max(...values))}`],
                ['판정 기준', `변화가 판정 기준 ${thr}\u00a0m보다 작아 판정 가능 가로선이 ${s.judgeable}개입니다.`],
                grades && gradeRuns(grades, 2021) && ['실태조사 침식등급', gradeRuns(grades, 2021)],
                grades && ['출처', '해양수산부 연안포털, 연안침식실태조사 화진포 침식등급이력(열람 2026. 11. 3.)']
              ]} />
            </Box>
          )}

          {!isControl && s.judgeable === 0 && (
            <Box title="별표 10 점수" sub={ANNEX}>
              <p className="cs-text"><strong>판정 가능 {s.judgeable}/{s.total}, 현장 측량 대상</strong></p>
              <p className="cs-text">값이 있는 가로선 {s.sectionN}개 가운데 판정 보류 기준 {thr}{'\u00a0'}m({basisLabel})를 넘는 가로선이 없어 위성 해안선으로 점수를 내지 않습니다. 해빈 측량으로 해빈폭과 단면을 확인합니다.</p>
            </Box>
          )}

          {!isControl && s.judgeable > 0 && (
            <Box title="별표 10 점수" sub={ANNEX} flush foot={meanDef}>
              <TableWrap label="별표 10 점수 표">
                <table className="cs-table">
                  <thead><tr><th>항목</th><th>배점 식</th><th className="is-num">위성 해안선 값</th></tr></thead>
                  <tbody>
                    <tr><td>평균 해빈폭</td><td className="is-wrap"><Ph t={['10 + 10 x 변화율,', '최대 20점,', '최소 10점']} /></td><td className="is-num is-wrap"><span className="rb-phrase">구간 평균</span> <span className="rb-phrase">{signed(s.sectionMean)}</span></td></tr>
                    <tr><td>목표해안선 적합도</td><td className="is-wrap"><Ph t={['20 + 20 x (B - A),', '최대 40점,', '최소 20점']} /></td><td className="is-num is-wrap">{typeof fitScore === 'number' && <><span className="rb-phrase">{fitScore.toFixed(1)}점</span> <span className="rb-phrase is-sub">목표선 바다 쪽 10{'\u00a0'}m</span></>}</td></tr>
                    <tr><td>등급 구간</td><td className="is-wrap" colSpan={2}><Ph t={['A 85점 이상,', 'B 75점 이상,', 'C 65점 이상,', 'D 55점 이상,', 'E 55점 미만']} /></td></tr>
                  </tbody>
                </table>
              </TableWrap>
            </Box>
          )}

          {!isControl && s.judgeable > 0 && (
            <Box title="해빈폭 점수" sub="사업 전 평균 해빈폭별" flush foot={<><span className="rb-phrase">사업 전 평균 해빈폭 네 경우의 점수입니다.</span>{unified && <> <span className="rb-phrase">점수 변동은 아래 오차 유형별 표에 있습니다.</span></>}</>}>
              <TableWrap label="해빈폭 점수 표">
                <table className="cs-table">
                  <thead><tr><th className="is-wrap">사업 전 평균 해빈폭</th><th className="is-num">구간 평균</th><th className="is-num">점수</th></tr></thead>
                  <tbody>
                    {[20, 30, 50, 100].map((w0) => (
                      <tr key={w0}><td className="cs-num">{w0}{'\u00a0'}m</td><td className="is-num">{signed(s.sectionMean)}</td><td className="is-num">{beachWidthScore(w0, s.sectionMean)}점</td></tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Box>
          )}

          {!isControl && !unified && inputs?.targetFit.length > 0 && s.judgeable > 0 && (
            <Box title="목표해안선 적합도" sub="목표해안선 위치별" flush foot={<span className="rb-phrase">사업 전 해빈폭 50{'\u00a0'}m 조건입니다.</span>}>
              <TableWrap label="목표해안선 적합도 표">
                <table className="cs-table">
                  <thead><tr><th>목표해안선 위치</th><th className="is-num">점수</th></tr></thead>
                  <tbody>
                    {inputs.targetFit.map((t) => (
                      <tr key={t.offset}><td className="is-wrap"><span className="rb-phrase">사업 전 해안선에서</span> <span className="rb-phrase">바다 쪽 {t.offset}{'\u00a0'}m</span></td><td className="is-num">{t.score}점</td></tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Box>
          )}

          {unified && (
            <Box title="오차 유형별 점수 변동" sub={`위성 위치 오차 ${unified.errorM}\u00a0m`} flush foot={<>
              <span className="rb-phrase">가로선 {unified.nTransects}개 평균 변화 {signed(unified.meanChange)},</span> <span className="rb-phrase">사업 전 해빈폭 {unified.w0}{'\u00a0'}m와 목표해안선 바다 쪽 {unified.offset}{'\u00a0'}m 조건의</span> <span className="rb-phrase">1표준편차 점수입니다.</span>{' '}
              <span className="rb-phrase">전은 별표 10 상하한을 적용하기 전,</span> <span className="rb-phrase">후는 해빈폭 10점에서 20점과 적합도 20점에서 40점으로 자른 값입니다.</span>{' '}
              <span className="rb-phrase">별표 10 점수는 상하한을 적용하므로</span> <span className="rb-phrase">후 열을 씁니다.</span>{' '}
              <span className="rb-phrase">치우침은 모든 가로선에 같은 방향으로,</span> <span className="rb-phrase">흩어짐은 가로선마다 따로 걸리는 오차입니다.</span>{' '}
              <span className="rb-phrase">혼합은 Sand Motor 측량 대조 비율대로</span> <span className="rb-phrase">치우침 37.5%를 섞었습니다.</span>{' '}
              <span className="rb-phrase">목표선이 없는 사업은</span> <span className="rb-phrase">종합 점수에 10/6을 곱합니다.</span>
            </>}>
              <TableWrap label="오차 유형별 점수 변동 표">
                <table className="cs-table is-grouped">
                  <thead>
                    <tr><th rowSpan={2}>오차 유형</th><th colSpan={2} className="is-group">해빈폭</th><th colSpan={2} className="is-group">적합도</th><th colSpan={2} className="is-group">상관</th><th colSpan={2} className="is-group">합계</th><th colSpan={2} className="is-group">등급 변경</th><th colSpan={2} className="is-group is-wrap">목표선 없음 x 10/6</th></tr>
                    <tr>{Array.from({ length: 6 }, (_, i) => [<th key={`a${i}`} className="is-num">전</th>, <th key={`b${i}`} className="is-num">후</th>])}</tr>
                  </thead>
                  <tbody>
                    {unified.rows.map((r) => (
                      <tr key={r.mode}>
                        <td className="is-wrap">{r.label}</td>
                        <td className="is-num">{pt(r.beachWidth[0])}</td><td className="is-num">{pt(r.beachWidth[1])}</td>
                        <td className="is-num">{pt(r.fit[0])}</td><td className="is-num">{pt(r.fit[1])}</td>
                        <td className="is-num">{two(r.corr[0])}</td><td className="is-num">{two(r.corr[1])}</td>
                        <td className="is-num">{pt(r.total[0])}</td><td className="is-num"><strong>{pt(r.total[1])}</strong></td>
                        <td className="is-num">{pc(r.pGrade[0])}</td><td className="is-num">{pc(r.pGrade[1])}</td>
                        <td className="is-num">{pt(r.noTarget[0])}</td><td className="is-num">{pt(r.noTarget[1])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Box>
          )}

          {excludedRows.length > 0 && (
            <Box title="구조물 의심 제외" sub={`${excludedRows.length}개`}>
              <KV items={[
                ['가로선', excludedRows.map((r) => r.id).join(', ')],
                ['제외 규칙', 'NDWI 변화와 MNDWI 변화의 차이가 22.9\u00a0m를 넘거나 어느 장면의 물가선이 구조물에서 30\u00a0m 이내이면 판정과 90퍼센타일 계산에서 뺍니다.'],
                ['구조물 위치', '고해상도 바탕 영상에서 딴 잠제 추정 3곳과 반암항 방파제입니다.'],
                ['구간 평균', `구조물 의심을 뺀 가로선 ${s.sectionN}개 평균 ${signed(s.sectionMean)}`]
              ]} />
            </Box>
          )}

          {fp.length > 0 && (
            <Box title="보류 기준과 거짓 판정" sub="변화가 없는 가로선 기준" flush foot={<><span className="rb-phrase">거짓 판정 비율은 변화량 오차를 표준편차 22.92{'\u00a0'}m 정규분포로 둔 값입니다.</span> <span className="rb-phrase">기대 거짓 판정은 판정 대상 가로선 수에 이 비율을 곱했습니다.</span></>}>
              <TableWrap label="보류 기준과 거짓 판정 표">
                <table className="cs-table">
                  <thead><tr><th>기준</th><th className="is-num">보류 기준</th><th className="is-num is-wrap">거짓 판정 비율</th><th className="is-num is-wrap">기대 거짓 판정</th><th className="is-num">판정 가능</th></tr></thead>
                  <tbody>
                    {fp.map((r) => (
                      <tr key={r.basis} className={r.basis === basis ? 'is-current' : undefined}><td>{r.label}{r.basis === basis && <span className="is-sub"> 선택</span>}</td><td className="is-num">{r.thresholdM}{'\u00a0'}m</td><td className="is-num">{(r.rate * 100).toFixed(1)}%</td><td className="is-num is-wrap">{r.n}개 중 {r.expected.toFixed(1)}개</td><td className="is-num">{r.judgeable}개</td></tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Box>
          )}

          <Box title="가로선별 전후 변화" sub={`${rows.length}개`} flush>
            <TableWrap label="가로선별 전후 변화 표">
              <table className="cs-table">
                <thead><tr><th>가로선</th><th className="is-num">변화</th><th><span className="sr-only">변화 막대</span></th><th>판정</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="cs-num">{r.id}</td>
                      <td className="is-num">{signed(r.change)}</td>
                      <td style={{ width: '40%' }}><Bar value={r.change} max={max} verdict={r.verdict} /></td>
                      <td><Verdict v={r.verdict} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Box>
        </div>

        <aside className="cs-col">
          <Box title="대장 옮김 문구" flush actions={text && (
            <Button onClick={copy} aria-describedby="copy-state">
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? '복사 완료' : '복사'}
            </Button>
          )}>
            {text ? (
              <>
                <label htmlFor="ledger" className="sr-only">대장 옮김 문구</label>
                <textarea id="ledger" ref={areaRef} readOnly value={text} rows={Math.min(12, text.split('\n').length + 1)} className="cs-ledger" />
              </>
            ) : <p className="cs-state">판정 가능 가로선이 없습니다.</p>}
            <p id="copy-state" role="status" className="sr-only">{copied ? '문구를 복사했습니다.' : ''}</p>
          </Box>

          {held.length > 0 && (
            <Box title="판정 보류" sub={`${held.length}개`}>
              <KV items={[['가로선', held.map((r) => r.id).join(', ')], ['처리', HOLD_ACTION]]} />
            </Box>
          )}

          {typeRules.length > 0 && (
            <Box title="사업 유형별 해석">
              <KV items={typeRules.map((t) => [t.label, t.text])} />
            </Box>
          )}

          <Box title="사업 개요">
            <KV items={[
              ['사업 내용', site.kind],
              site.completion && ['준공', fmtDate(site.completion)],
              facts && ['사업비', `약 ${facts.eok}억 원(해양수산부 연안정비 사업정보)`],
              facts && !facts.legal && ['효과평가', '효과평가 법정 대상(사업비 200억 원 이상)이 아니며 별표 10 적용 방법을 보여 주는 사업지입니다.'],
              ['판정 보류 기준', `${thr}\u00a0m(${basisLabel})`],
              ['비교 기간', `${fmtDate(data.period.from)}부터 ${fmtDate(data.period.to)}까지`]
            ]} />
          </Box>
          <Note icon={ShieldCheck}>{RESPONSIBILITY}</Note>
        </aside>
      </div>
    </>
  )
}
