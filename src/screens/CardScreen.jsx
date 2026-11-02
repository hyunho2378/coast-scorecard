// 판정 카드. UX 리서치 패키지 9장 설계: 담당자가 사후관리대장에 그대로 옮겨 적는 한 장
import { useMemo, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Card, Chip, PageHeader, TestBadge, TideBadge, Stat, SiteState, ChangeBars, DefList, TestNotice, StateBlock, Button, RESPONSIBILITY, HOLD_ACTION } from '../ui/index.jsx'
import { ledgerText, fmtDate } from '../lib/ledger.js'
import { gradeSensitivity, holdRuleCheck, typeRulesFor } from '../lib/loader-core.js'
import { isJudgeable } from '../lib/judge.js'

const pct = (v) => `${Math.round(v * 100)}%`
const signed = (v) => (v === null ? '값 없음' : `${v > 0 ? '+' : ''}${v.toFixed(1)} m`)

export default function CardScreen({ site, data, rules }) {
  const [copied, setCopied] = useState(false)
  const areaRef = useRef(null)
  const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }, [])
  const state = <SiteState data={data} />
  const header = (
    <PageHeader title={`${site.name} 판정 카드`} desc={`${site.region}, ${site.country}. ${site.kind}`}
      badges={<><TestBadge />{data?.status === 'ready' && <TideBadge label={data.tide} />}</>} />
  )
  if (data?.status !== 'ready') return <>{header}<TestNotice />{state}</>

  const s = data.summary
  const rows = data.rows
  const held = rows.filter((r) => !isJudgeable(r.verdict))
  const text = ledgerText({ site, rows, period: data.period, tide: data.tide, today })
  const sens = gradeSensitivity(rules?.data, site.id)
  const holdCheck = holdRuleCheck(rules?.data, site.id, s)
  const typeRules = typeRulesFor(rules?.data, site.typeRules)
  const thr = s.thresholds.length ? s.thresholds.map((t) => `${t} m`).join(', ') : '기준 없음'

  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch {
      areaRef.current?.select(); document.execCommand?.('copy')
    }
    setCopied(true); setTimeout(() => setCopied(false), 2400)
  }

  return (
    <>
      {header}
      <TestNotice />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="사업 개요">
            <DefList items={[
              ['준공 시기', site.completion ? fmtDate(site.completion) : <span>준공일 미확인<span className="mt-0.5 block type-meta text-text-meta">{site.completionNote}</span></span>],
              ['비교 기간', `${fmtDate(data.period.from)}부터 ${fmtDate(data.period.to)}까지, 맑은 장면 ${data.scenes.length}장`],
              ['판정 보류 기준', `${thr}. 사업지 같은 계절 장면쌍 차이로 정한 분석 파일 값이며, 변화가 이보다 작으면 판정 보류`],
              ['해빈폭 변화', s.judgeable ? `판정 가능 가로선 중앙값 ${signed(s.medianChange)}, 범위 ${signed(s.minChange)}부터 ${signed(s.maxChange)}까지` : '판정 가능 가로선 없음'],
              ['조위', data.tide === '조위 보정' ? '관측 수위와 측량 경사로 평균고조위 기준 환산한 값' : '조위와 파랑을 보정하지 않은 순간 물가선 비교값']
            ]} />
          </Card>

          <Card title="판정 개수" action={<span className="type-meta text-text-meta">전체 가로선 {s.total}개</span>}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="판정 가능" value={s.judgeable} unit="개" sub={`전체의 ${pct(s.judgeableRatio)}`} tone="primary" />
              <Stat label="판정 보류" value={s.held} unit="개" sub={`전체의 ${pct(s.heldRatio)}`} tone="hold" />
              <Stat label="바다 쪽 전진" value={s.advance} unit="개" tone="advance" />
              <Stat label="육지 쪽 후퇴" value={s.retreat} unit="개" tone="retreat" />
            </div>
            {s.nodata > 0 && <p className="mt-2 type-meta text-text-meta">판정 보류 가운데 {s.nodata}개는 구름으로 해안선을 찾지 못한 가로선입니다.</p>}
          </Card>

          {holdCheck && !holdCheck.same && (
            <StateBlock kind="hold" title="판정 보류 기준 갱신 대기">
              <p>가로선 파일 기준 {holdCheck.fileM.join(', ')}{'\u00a0'}m로 판정한 화면입니다. 새 규칙 파일의 이 사업지 기준은 {holdCheck.ruleM}{'\u00a0'}m(판정 가능 {holdCheck.ruleJudgeable}개)이며, 가로선 파일을 다시 만들면 이 화면 값이 바뀝니다.</p>
            </StateBlock>
          )}

          {typeRules.length > 0 && (
            <Card title="사업 유형별 해석 규칙">
              <ul className="flex flex-col gap-2">
                {typeRules.map((t) => (
                  <li key={t.label} className="rounded-sm bg-mute px-4 py-3">
                    <p className="type-caption text-text-sec">{t.label}</p>
                    <p className="type-body-sm text-text-pri">{t.text}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="별표 10 예비 지표" eyebrow="연안정비사업 효과평가 항목 대응">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="rounded-sm bg-mute px-4 py-3">
                <p className="type-caption text-text-sec">평균 해빈폭 변화, 20점 항목</p>
                <p className="type-h2 text-text-pri tabular-nums">{s.judgeable ? signed(s.meanChange) : '산출 불가'}</p>
                <p className="type-meta text-text-meta">{s.judgeable ? `판정 가능 가로선 ${s.judgeable}개 평균. 점수 환산 전 예비 값` : '판정 가능 가로선이 없어 비워 둡니다.'}</p>
              </div>
              <div className="rounded-sm bg-mute px-4 py-3">
                <p className="type-caption text-text-sec">목표해안선 적합도, 40점 항목</p>
                <p className="type-h2 text-text-sec">자료 연결 전</p>
                <p className="type-meta text-text-meta">사업 설계의 목표해안선 자료가 들어오면 만족 구간 길이로 계산합니다.</p>
              </div>
              <div className="rounded-sm bg-mute px-4 py-3 md:col-span-2">
                <p className="type-caption text-text-sec">위성 오차로 등급이 바뀔 수 있는 폭</p>
                {sens?.bandM ? (
                  <>
                    <p className="type-h2 text-text-pri tabular-nums">해빈폭 변화 ±{sens.bandM} m</p>
                    <p className="type-meta text-text-meta">
                      위성 오차 {sens.errorM}{'\u00a0'}m({sens.errorKind}) 기준입니다. 사업 전 해빈폭 {sens.w0}{'\u00a0'}m 가정에서 해빈폭 점수 등급이 바뀔 확률 {Math.round(sens.pGradeChange * 100)}%입니다.
                      {sens.targetFit && ` 목표해안선 적합도 점수는 오차 범위 안에서 ${sens.targetFit.p05}점부터 ${sens.targetFit.p95}점까지 움직입니다(모의 계산).`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="type-h2 text-text-sec">계산 중</p>
                    <p className="type-meta text-text-meta">{rules?.status === 'ok' ? '민감도 파일에 이 사업지 값이 없습니다.' : '민감도 계산 파일이 들어오면 채웁니다.'}</p>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card title="구간별 전후 변화">
            <ChangeBars rows={rows} />
          </Card>

          {held.length > 0 && (
            <StateBlock kind="hold" title={`판정 보류 가로선 ${held.length}개`}>
              <p className="type-body-sm text-text-pri">{HOLD_ACTION}</p>
              <p className="mt-1 type-meta text-text-meta">가로선 {held.map((r) => r.id).join(', ')}번</p>
            </StateBlock>
          )}

          <Card title="대장 옮김 문구" action={
            <Button variant="primary" onClick={copy} disabled={!text} aria-describedby="copy-state">
              {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
              {copied ? '복사 완료' : '문구 복사'}
            </Button>
          }>
            {text ? (
              <>
                <label htmlFor="ledger" className="sr-only">대장 옮김 문구</label>
                <textarea id="ledger" ref={areaRef} readOnly value={text} rows={Math.min(10, text.split('\n').length + 1)}
                  className="w-full resize-none rounded-sm bg-mute p-3 type-body-sm text-text-pri" />
                <p className="mt-2 type-meta text-text-meta">판정 가능 가로선만 넣었습니다. 판정 보류 가로선은 문구에서 뺍니다.</p>
              </>
            ) : (
              <p className="type-body-sm text-text-sec">판정 가능 가로선이 없어 옮길 문구가 없습니다. {HOLD_ACTION}</p>
            )}
            <p id="copy-state" role="status" className="sr-only">{copied ? '문구를 복사했습니다' : ''}</p>
          </Card>

          <p className="rounded-md bg-canvas px-5 py-4 type-body-strong text-text-pri">
            <Chip tone="primary" className="mr-2 align-middle">책임 원칙</Chip>{RESPONSIBILITY}
          </p>
        </div>
      </div>
    </>
  )
}
