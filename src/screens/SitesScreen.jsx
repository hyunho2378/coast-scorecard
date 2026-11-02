// 사업지 목록. 사업지마다 자료 상태와 판정 가능 비율을 한 장으로 보여 준다
import { ChevronRight } from 'lucide-react'
import { PageHeader, TestBadge, TideBadge, Chip, StateBlock } from '../ui/index.jsx'
import { fmtDate } from '../lib/ledger.js'

const pct = (v) => `${Math.round(v * 100)}%`

export default function SitesScreen({ sites, siteData, onOpen }) {
  return (
    <>
      <PageHeader title="사업지 목록" badges={<TestBadge />} desc={`연결한 사업지 ${sites.length}곳입니다. 사업지를 누르면 판정 카드를 엽니다.`} />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sites.map((s) => {
          const d = siteData[s.id] || { status: 'loading' }
          return (
            <li key={s.id}>
              <button type="button" onClick={() => onOpen(s.id)} className="pressable flex h-full w-full flex-col gap-4 rounded-md bg-canvas p-5 text-left shadow-sm hover:bg-mute">
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="type-h3 text-text-pri">{s.name}</p>
                    <p className="type-meta text-text-meta">{s.region}, {s.country}</p>
                  </div>
                  <ChevronRight size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-text-sec" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip>{s.kind}</Chip>
                  {d.status === 'ready' && <TideBadge label={d.tide} />}
                </div>
                {d.status === 'ready' ? (
                  <div className="grid w-full grid-cols-3 gap-2">
                    <div><p className="type-caption text-text-sec">가로선</p><p className="type-h2 text-text-pri tabular-nums">{d.summary.total}</p></div>
                    <div><p className="type-caption text-text-sec">판정 가능</p><p className="type-h2 text-primary-text tabular-nums">{d.summary.judgeable}<span className="ml-1 type-meta text-text-meta">{pct(d.summary.judgeableRatio)}</span></p></div>
                    <div><p className="type-caption text-text-sec">판정 보류</p><p className="type-h2 text-hold-text tabular-nums">{d.summary.held}<span className="ml-1 type-meta text-text-meta">{pct(d.summary.heldRatio)}</span></p></div>
                  </div>
                ) : d.status === 'loading' ? (
                  <p className="type-body-sm text-text-sec">자료 불러오는 중</p>
                ) : d.status === 'error' ? (
                  <p className="type-body-sm text-danger-text">자료를 읽지 못했습니다</p>
                ) : (
                  <p className="type-body-sm text-text-sec">분석 자료 없음</p>
                )}
                <p className="type-meta text-text-meta">
                  {d.status === 'ready' ? `비교 기간 ${fmtDate(d.period.from)}부터 ${fmtDate(d.period.to)}까지, 장면 ${d.scenes.length}장` : '비교 기간 미정'}
                  {' '}{s.completion ? `준공 ${fmtDate(s.completion)}` : '준공일 미확인'}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
      {!sites.length && <StateBlock kind="empty">사업지 설정 파일에 사업지가 없습니다.</StateBlock>}
    </>
  )
}
