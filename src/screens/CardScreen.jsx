// 판정 카드. 담당자가 사후관리대장에 옮겨 적는 한 장(UX 리서치 패키지 9장)
import { useMemo, useRef, useState } from 'react'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { Bar, Box, Button, KV, Note, PageHead, SiteState, Verdict, HOLD_ACTION, RESPONSIBILITY, pct, signed } from '../ui/index.jsx'
import { ledgerText, fmtDate } from '../lib/ledger.js'
import { scoreInputsFor, sensitivityFor, typeRulesFor } from '../lib/loader-core.js'
import { beachWidthScore, isJudgeable, roleOf, ROLE } from '../lib/judge.js'

const ANNEX = '해양수산부 고시 제2025-181호 별표 10'
// 구절 단위 줄바꿈(K1): 구절 안에서는 끊지 않는다
const Ph = ({ t }) => t.map((x, i) => <span key={x}>{i > 0 && ' '}<span className="rb-phrase">{x}</span></span>)

export default function CardScreen({ site, data, rules, onRetry }) {
  const [copied, setCopied] = useState(false)
  const areaRef = useRef(null)
  const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }, [])
  const head = (meta) => <PageHead title={`${site.name} 판정 카드`} meta={meta || <span>{site.region}, {site.country}</span>} />
  if (data?.status !== 'ready') return <>{head()}<SiteState data={data} onRetry={onRetry} /></>

  const s = data.summary
  const rows = data.rows
  const held = rows.filter((r) => !isJudgeable(r.verdict))
  const text = ledgerText({ site, rows, period: data.period, today })
  const role = roleOf(rules?.data?.site_rules?.[site.id])
  const isControl = role === 'control'
  const inputs = scoreInputsFor(rules?.data, site.id)
  const sens = isControl ? null : sensitivityFor(rules?.data, site.id)
  const typeRules = typeRulesFor(rules?.data, site.typeRules)
  const thr = s.thresholds[0]
  const max = Math.max(thr * 2, ...rows.map((r) => Math.abs(r.change ?? 0)), 1)
  const meanDef = `가로선 수준 값은 가로선 하나의 전후 이동 거리이고 구간 평균은 값이 있는 가로선 ${s.sectionN}개(판정 보류 포함)의 평균입니다.`

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
        <li><strong>{s.advance}</strong>전진</li>
        <li><strong>{s.retreat}</strong>후퇴</li>
        <li><strong>{thr}{'\u00a0'}m</strong>보류 기준</li>
        {s.sectionN > 0 && <li><strong>{signed(s.sectionMean)}</strong>구간 평균</li>}
      </ul>

      <div className="cs-two is-wide-side">
        <div className="cs-col">
          {isControl && (
            <Box title="대조 해변" sub="사업지 점수 계산 없음">
              <p className="cs-text">해양수산부 연안정비 사업정보에 화진포 이름의 사업이 없어 별표 10 점수를 계산하지 않습니다. 사업지 해안선 변화와 견주는 대조 해변으로 씁니다.</p>
            </Box>
          )}

          {!isControl && s.judgeable === 0 && (
            <Box title="별표 10 점수" sub={ANNEX}>
              <p className="cs-text"><strong>판정 가능 가로선 0개, 현장 측량 대상</strong></p>
              <p className="cs-text">값이 있는 가로선 {s.sectionN}개의 전후 변화가 모두 판정 보류 기준 {thr}{'\u00a0'}m 이하라서 위성 해안선으로 점수를 내지 않습니다. 해빈 측량으로 해빈폭과 단면을 확인합니다.</p>
            </Box>
          )}

          {!isControl && s.judgeable > 0 && (
            <Box title="별표 10 점수" sub={ANNEX} flush foot={meanDef}>
              <div className="cs-table-wrap">
                <table className="cs-table">
                  <thead><tr><th>항목</th><th>배점 식</th><th className="is-num">위성 해안선 값</th></tr></thead>
                  <tbody>
                    <tr><td>평균 해빈폭</td><td className="is-wrap"><Ph t={['10 + 10 x 변화율,', '최대 20점, 최소 10점']} /></td><td className="is-num">구간 평균 {signed(s.sectionMean)}</td></tr>
                    <tr><td>목표해안선 적합도</td><td className="is-wrap"><Ph t={['20 + 20 x (B - A),', '최대 40점, 최소 20점']} /></td><td className="is-num">{inputs?.targetFit[0] ? `${inputs.targetFit[0].score}점` : ''}</td></tr>
                    <tr><td>등급 구간</td><td className="is-wrap" colSpan={2}><Ph t={['A 85점 이상,', 'B 75점 이상,', 'C 65점 이상,', 'D 55점 이상,', 'E 55점 미만']} /></td></tr>
                  </tbody>
                </table>
              </div>
            </Box>
          )}

          {!isControl && inputs && s.judgeable > 0 && (
            <Box title="해빈폭 점수" sub="사업 전 평균 해빈폭별" flush foot={`위성 오차 점수 변동은 위치 오차 ${inputs.errorM}\u00a0m 치우침 기준 1표준편차입니다.`}>
              <div className="cs-table-wrap">
                <table className="cs-table">
                  <thead><tr><th>사업 전 평균 해빈폭</th><th className="is-num">구간 평균</th><th className="is-num">점수</th><th className="is-num">위성 오차 점수 변동</th></tr></thead>
                  <tbody>
                    {inputs.beachWidth.map((b) => (
                      <tr key={b.w0}><td className="cs-num">{b.w0}{'\u00a0'}m</td><td className="is-num">{signed(s.sectionMean)}</td><td className="is-num">{beachWidthScore(b.w0, s.sectionMean)}점</td><td className="is-num">약 {b.sd.toFixed(1)}점</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          )}

          {!isControl && inputs?.targetFit.length > 0 && s.judgeable > 0 && (
            <Box title="목표해안선 적합도" sub="목표해안선 위치별" flush>
              <div className="cs-table-wrap">
                <table className="cs-table">
                  <thead><tr><th>목표해안선 위치</th><th className="is-num">점수</th><th className="is-num">위성 오차 점수 변동</th></tr></thead>
                  <tbody>
                    {inputs.targetFit.map((t) => (
                      <tr key={t.offset}><td>사업 전 해안선에서 바다 쪽 {t.offset}{'\u00a0'}m</td><td className="is-num">{t.score}점</td><td className="is-num">약 {t.sd.toFixed(1)}점</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          )}

          {sens && (
            <Box title="오차 유형별 점수 변동" sub={`위성 위치 오차 ${sens.errorM}\u00a0m`} flush foot={<>
              <span className="rb-phrase">사업 전 해빈폭 {sens.w0}{'\u00a0'}m와 목표해안선 바다 쪽 {sens.offset}{'\u00a0'}m 조건의</span> <span className="rb-phrase">1표준편차 점수입니다.</span>{' '}
              <span className="rb-phrase">치우침은 모든 가로선에 같은 방향으로,</span> <span className="rb-phrase">흩어짐은 가로선마다 따로 걸리는 오차입니다.</span>{' '}
              <span className="rb-phrase">혼합은 Sand Motor 측량 대조 비율대로</span> <span className="rb-phrase">치우침 37.5%를 섞었습니다.</span>
            </>}>
              <div className="cs-table-wrap">
                <table className="cs-table">
                  <thead><tr><th>오차 유형</th><th className="is-num">해빈폭 점수</th><th className="is-num">적합도 점수</th><th className="is-num">두 점수 상관</th><th className="is-num">합계</th><th className="is-num">등급 변경</th></tr></thead>
                  <tbody>
                    {sens.rows.map((r) => (
                      <tr key={r.mode}><td>{r.label}</td><td className="is-num">{r.beachWidth.toFixed(2)}점</td><td className="is-num">{r.fit.toFixed(2)}점</td><td className="is-num">{typeof r.corr === 'number' ? r.corr.toFixed(2) : '없음'}</td><td className="is-num">{r.total.toFixed(2)}점</td><td className="is-num">{pct(r.pGrade)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          )}

          <Box title="가로선별 전후 변화" sub={`${rows.length}개`} flush>
            <div className="cs-table-wrap">
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
            </div>
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
              ['판정 보류 기준', `${thr}\u00a0m`],
              ['비교 기간', `${fmtDate(data.period.from)}부터 ${fmtDate(data.period.to)}까지`]
            ]} />
          </Box>
          <Note icon={ShieldCheck}>{RESPONSIBILITY}</Note>
        </aside>
      </div>
    </>
  )
}
