// 공유 부품. 배치는 공공 깃랩 목록 상자(rb-listbox)와 표(rb-reftable)를 따르고 값은 KRDS 변수만 쓴다
import { ArrowDownLeft, ArrowUpRight, Ban, Check, ChevronDown, CircleAlert, Info, Minus } from 'lucide-react'
import { usePopover } from './popover.js'

export const HOLD_ACTION = '정규 측량 일정 가로선은 현장 측량으로 확인합니다.'

export const signed = (v) => (v === null || v === undefined ? '' : `${v > 0 ? '+' : ''}${v.toFixed(1)}\u00a0m`)
export const pct = (v) => `${Math.round(v * 100)}%`

export function PageHead({ title, meta, actions }) {
  return (
    <header className="cs-head">
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {meta && <div className="cs-head-meta">{meta}</div>}
      </div>
      {actions && <div className="cs-head-actions">{actions}</div>}
    </header>
  )
}

export function Box({ title, sub, actions, foot, children, flush = false, as: Tag = 'section', ...rest }) {
  return (
    <Tag className="cs-box" {...rest}>
      {(title || actions) && (
        <div className="cs-box-head">
          <h2>{title}{sub && <span className="cs-sub"> {sub}</span>}</h2>
          {actions}
        </div>
      )}
      {flush ? children : <div className="cs-box-body">{children}</div>}
      {foot && <div className="cs-box-foot">{foot}</div>}
    </Tag>
  )
}

export function Button({ variant = 'secondary', children, ...rest }) {
  return <button type="button" className={`krds-btn small ${variant}`} {...rest}>{children}</button>
}

const V = {
  advance: { Icon: ArrowUpRight, label: '전진' },
  retreat: { Icon: ArrowDownLeft, label: '후퇴' },
  hold: { Icon: Minus, label: '정규 측량 일정' },
  nodata: { Icon: Minus, label: '정규 측량 일정' },
  few: { Icon: Minus, label: '정규 측량 일정' },
  struct: { Icon: Ban, label: '구조물 의심, 제외' }
}
export function Verdict({ v }) {
  const x = V[v] || V.hold
  return <span className={`cs-verdict is-${V[v] ? v : 'hold'}`}><x.Icon size={16} aria-hidden="true" />{x.label}</span>
}

export function Bar({ value, max, verdict }) {
  if (value === null || value === undefined) return <span className="cs-bar" aria-hidden="true"><span className="cs-bar-zero" /></span>
  const w = `${Math.min(50, (Math.abs(value) / max) * 50)}%`
  const pos = value >= 0 ? { left: '50%', width: w } : { right: '50%', width: w }
  return <span className="cs-bar" aria-hidden="true"><span className="cs-bar-zero" /><span className={`cs-bar-fill is-${verdict}`} style={pos} /></span>
}

// 데이터 상태: Loading(줄 뼈대), Empty(한 줄), Error(한 줄과 다시 읽기)
export function Loading({ rows = 4, label = '불러오는 중' }) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="cs-skel-row" aria-hidden="true">
          <span className="cs-skel" style={{ width: `calc(var(--krds-number-21) * ${1 + (i % 3)})` }} />
          <span className="cs-skel" style={{ width: 'var(--krds-number-21)', marginInlineStart: 'auto' }} />
        </div>
      ))}
    </div>
  )
}
export function Empty({ children }) {
  return <p className="cs-state" role="status"><Info size={16} aria-hidden="true" />{children}</p>
}
export function ErrorLine({ children, onRetry, retryLabel = '다시 읽기' }) {
  return (
    <div className="cs-state is-error" role="alert">
      <CircleAlert size={16} aria-hidden="true" /><span>{children}</span>
      {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
    </div>
  )
}

export function SiteState({ data, onRetry }) {
  if (!data || data.status === 'loading') return <Box flush><Loading /></Box>
  if (data.status === 'error') return <Box flush><ErrorLine onRetry={onRetry}>분석 파일 읽기 실패</ErrorLine></Box>
  if (data.status === 'empty') return <Box flush><Empty>해안선 파일 없음</Empty></Box>
  return null
}

export function KV({ items, row = false }) {
  return (
    <dl className={`cs-kv${row ? ' is-row' : ''}`}>
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  )
}

export function Note({ icon: Icon = Info, children }) {
  return <p className="cs-note"><Icon size={16} aria-hidden="true" /><span>{children}</span></p>
}

// 가로로 넘치는 표 영역. 키보드로 초점을 받아 좌우 화살표로 스크롤한다
export function TableWrap({ label, children }) {
  return <div className="cs-table-wrap" role="region" aria-label={label} tabIndex={0}>{children}</div>
}

// 운영체제 기본 선택 상자 대신 쓰는 메뉴 선택(menuitemradio). 화면 설정 메뉴와 같은 cs-pop 부품
export function Pick({ label, value, options, onChange, disabled, wide }) {
  const p = usePopover()
  const cur = options.find(([v]) => v === value) || options[0]
  return (
    <div className="cs-pick">
      <button ref={p.btn} type="button" className="cs-pick-btn" aria-haspopup="menu" aria-expanded={p.open} aria-label={`${label} ${cur?.[1] ?? ''}`} disabled={disabled} onClick={() => p.setOpen(!p.open)}>
        <span className="cs-pick-val">{cur?.[1]}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      {p.open && (
        <ul ref={p.ref} className={`cs-pop${wide ? ' is-wide' : ''}`} role="menu" aria-label={label}>
          {options.map(([v, text]) => (
            <li key={String(v)} role="none">
              <button type="button" role="menuitemradio" aria-checked={v === value} onClick={() => { onChange(v); p.setOpen(false); p.btn.current?.focus() }}>
                <span className="cs-pop-check">{v === value && <Check size={16} aria-hidden="true" />}</span>{text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 두세 개 중 하나를 고르는 단추 묶음(radiogroup). 좌우 화살표로 옮긴다
export function Segmented({ label, value, options, onChange, disabled }) {
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const n = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length]
    onChange(n[0]); e.preventDefault()
    e.currentTarget.parentElement.querySelectorAll('button')[options.indexOf(n)]?.focus()
  }
  return (
    <div className="cs-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text], i) => (
        <button key={String(v)} type="button" role="radio" aria-checked={v === value} tabIndex={v === value ? 0 : -1} disabled={disabled} onKeyDown={(e) => onKey(e, i)} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  )
}

export function Field({ label, htmlFor, children, unit }) {
  return (
    <div className="cs-field">
      {htmlFor ? <label htmlFor={htmlFor} className="cs-field-label">{label}</label> : <span className="cs-field-label">{label}</span>}
      <div className="cs-field-ctl">{children}{unit && <span className="cs-field-unit">{unit}</span>}</div>
    </div>
  )
}

// 숫자 카드(현황판 위쪽, 4개 이하)
export function Stat({ label, value, unit, tone }) {
  return (
    <div className={`cs-stat${tone ? ` is-${tone}` : ''}`}>
      <span className="cs-stat-label">{label}</span>
      <span className="cs-stat-value cs-num">{value}{unit && <span className="cs-stat-unit">{unit}</span>}</span>
    </div>
  )
}
