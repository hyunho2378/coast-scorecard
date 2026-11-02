// 공유 부품. 모든 화면은 이 파일의 부품과 tokens.js 에서 나온 클래스만 쓴다
import clsx from 'clsx'
import { AlertTriangle, CircleSlash, Info, Loader2 } from 'lucide-react'

export function Card({ title, eyebrow, action, className, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={clsx('rounded-md bg-canvas p-5', className)} {...rest}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {eyebrow && <p className="type-caption text-primary-text">{eyebrow}</p>}
            {title && <h2 className="type-h3 text-text-pri">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </Tag>
  )
}

const CHIP = {
  advance: 'bg-advance text-text-inverse',
  retreat: 'bg-retreat text-text-inverse',
  hold: 'bg-hold text-text-inverse',
  nodata: 'bg-hold text-text-inverse',
  sand: 'bg-sand text-text-inverse',
  primary: 'bg-primary text-text-inverse',
  neutral: 'bg-mute text-text-pri'
}
export function Chip({ tone = 'neutral', className, children }) {
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 type-caption', CHIP[tone], className)}>{children}</span>
}

export function TestBadge() { return <Chip tone="sand">시험값</Chip> }

export function TideBadge({ label }) {
  return <Chip tone={label === '조위 보정' ? 'primary' : 'neutral'}>{label}</Chip>
}

const BTN = {
  primary: 'bg-primary text-text-inverse hover:bg-primary-hover',
  soft: 'bg-mute text-text-pri hover:bg-line-def',
  ghost: 'bg-transparent text-text-sec hover:bg-mute hover:text-text-pri'
}
export function Button({ variant = 'soft', className, children, ...rest }) {
  return (
    <button type="button" className={clsx('pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 type-strong disabled:cursor-not-allowed disabled:opacity-50', BTN[variant], className)} {...rest}>
      {children}
    </button>
  )
}

export function PageHeader({ title, desc, badges, action }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="type-h1 text-text-pri">{title}</h1>
          {badges}
        </div>
        {desc && <p className="mt-1 max-w-text type-body-sm text-text-sec">{desc}</p>}
      </div>
      {action}
    </header>
  )
}

const TONE_TEXT = { advance: 'text-advance-text', retreat: 'text-retreat-text', hold: 'text-hold-text', primary: 'text-primary-text' }
export function Stat({ label, value, unit, sub, tone }) {
  return (
    <div className="rounded-sm bg-mute px-4 py-3">
      <p className="type-caption text-text-sec">{label}</p>
      <p className={clsx('type-kpi', TONE_TEXT[tone] || 'text-text-pri')}>
        {value}{unit && <span className="ml-1 type-meta text-text-meta">{unit}</span>}
      </p>
      {sub && <p className="type-meta text-text-meta">{sub}</p>}
    </div>
  )
}

// 상태 칸: 불러오는 중, 자료 없음, 오류, 판정 보류
const STATE = {
  loading: { Icon: Loader2, tone: 'text-primary-text', title: '자료 불러오는 중' },
  empty: { Icon: CircleSlash, tone: 'text-text-sec', title: '분석 자료 없음' },
  error: { Icon: AlertTriangle, tone: 'text-danger-text', title: '자료를 읽지 못했습니다' },
  hold: { Icon: Info, tone: 'text-hold-text', title: '판정 보류' }
}
export function StateBlock({ kind, title, children, action, className }) {
  const s = STATE[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={clsx('rounded-md bg-canvas p-5', className)}>
      <div className="flex items-start gap-3">
        <s.Icon size={20} aria-hidden="true" className={clsx('mt-0.5 shrink-0', s.tone, kind === 'loading' && 'motion-safe:animate-spin')} />
        <div className="min-w-0">
          <p className="type-strong text-text-pri">{title || s.title}</p>
          {children && <div className="mt-1 type-body-sm text-text-sec">{children}</div>}
          {kind === 'loading' && (
            <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
              <span className="skeleton-bar block h-3 w-48 max-w-full rounded-full bg-mute" />
              <span className="skeleton-bar block h-3 w-32 max-w-full rounded-full bg-mute" />
            </div>
          )}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  )
}

// 사업지 자료 상태에 맞는 칸. ready 이면 null
export function SiteState({ data }) {
  if (!data || data.status === 'loading') return <StateBlock kind="loading">사업지 해안선과 가로선 파일을 읽고 있습니다.</StateBlock>
  if (data.status === 'error') return <StateBlock kind="error">{data.message}. 개발 서버와 분석 폴더 연결을 확인합니다.</StateBlock>
  if (data.status === 'empty') return <StateBlock kind="empty">분석 폴더에 이 사업지의 해안선과 가로선 파일이 아직 없습니다. 파일이 들어오면 이 화면에 바로 표시합니다.</StateBlock>
  return null
}

export const RESPONSIBILITY = '위성 판정은 참고 자료이고 최종 판단은 관리주체의 현장 점검이 정합니다.'
export const HOLD_ACTION = '해당 가로선은 현장 측량으로 확인합니다.'

export function TestNotice() {
  return (
    <p className="rounded-md bg-warning-soft px-4 py-3 type-body-sm text-warning-text">
      시험 분석값입니다. 공식 판정 결과로 쓰지 않습니다.
    </p>
  )
}

const BAR = { advance: 'bg-advance', retreat: 'bg-retreat', hold: 'bg-hold', nodata: 'bg-hold' }
// 가로선별 전후 변화 막대. 오른쪽은 바다 쪽 전진, 왼쪽은 육지 쪽 후퇴
export function ChangeBars({ rows, label = '가로선별 전후 변화' }) {
  const vals = rows.map((r) => Math.abs(r.change ?? 0))
  const thr = Math.max(0, ...rows.map((r) => r.threshold || 0))
  const max = Math.max(thr * 2, ...vals, 1)
  const longId = rows.some((r) => String(r.id).length > 4)
  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      <div className="mb-2 flex justify-between type-meta text-text-meta"><span>육지 쪽 후퇴</span><span>바다 쪽 전진</span></div>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.id} className={clsx('grid items-center gap-2', longId ? 'grid-cols-[112px_minmax(0,1fr)_104px]' : 'grid-cols-[64px_minmax(0,1fr)_104px]')}>
            <span className="type-meta text-text-sec tabular-nums">가로선 {r.id}</span>
            <span className="relative h-3 rounded-full bg-mute" aria-hidden="true">
              <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-line-strong" />
              {r.change !== null && (
                <span className={clsx('absolute inset-y-0 rounded-full', BAR[r.verdict])}
                  style={r.change >= 0 ? { left: '50%', width: `${(r.change / max) * 50}%` } : { right: '50%', width: `${(-r.change / max) * 50}%` }} />
              )}
            </span>
            <span className="flex items-center justify-end gap-1 tabular-nums">
              <span className="type-meta text-text-pri">{r.change === null ? '값 없음' : `${r.change > 0 ? '+' : ''}${r.change.toFixed(1)} m`}</span>
              <Chip tone={r.verdict}>{r.verdict === 'advance' ? '전진' : r.verdict === 'retreat' ? '후퇴' : '보류'}</Chip>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

export function DefList({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_minmax(0,1fr)]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="type-caption text-text-sec sm:pt-0.5">{k}</dt>
          <dd className="type-body-sm text-text-pri">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
