// 전역 틀. 공공 깃랩 D-21 배치(상단 바 48, 왼쪽 세로 바 240, 오른쪽 둥근 판)를 따른다.
// 왼쪽 세로 바 맨 위는 사업지 선택(공공 깃랩 프로젝트 이름 자리), 그 아래 묶음 두 개.
// 768 미만은 왼쪽 세로 바를 숨기고 상단 바의 메뉴 단추로 연다
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronsUpDown, Columns2, FileText, Globe2, List, ListChecks, Map, Menu, Monitor, Ruler, X } from 'lucide-react'
import { BASES } from '../lib/judge.js'
import { NAV } from './route.js'
import { MODES, useScreenMode } from './screenMode.js'

const ICON = { globe: Globe2, sites: List, storm: ListChecks, sources: BookOpen, card: FileText, map: Map, compare: Columns2 }
const ALL = ['globe', 'sites', 'storm', 'sources']
const SITE = ['card', 'map', 'compare']

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const btn = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const first = ref.current?.querySelector('[aria-checked="true"]') || ref.current?.querySelector('button')
    first?.focus()
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...ref.current.querySelectorAll('button')]
        const i = items.indexOf(document.activeElement)
        const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]
        next?.focus(); e.preventDefault()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen, ref, btn }
}

function SitePick({ sites, siteId, onSite }) {
  const p = usePopover()
  const cur = sites.find((s) => s.id === siteId) || sites[0]
  return (
    <div className="cs-sitepick">
      <button ref={p.btn} type="button" className="cs-sitepick-btn" aria-haspopup="menu" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="cs-sitepick-name">{cur?.name}</span>
          <span className="cs-sitepick-sub">{cur ? `${cur.region}, ${cur.country}` : ''}</span>
        </span>
        <ChevronsUpDown size={16} aria-hidden="true" className="cs-side-icon" />
      </button>
      {p.open && (
        <ul ref={p.ref} className="cs-pop" role="menu" aria-label="사업지 선택">
          {sites.map((s) => (
            <li key={s.id} role="none">
              <button type="button" role="menuitemradio" aria-checked={s.id === siteId} onClick={() => { onSite(s.id); p.setOpen(false); p.btn.current?.focus() }}>
                <span className="cs-pop-check">{s.id === siteId && <Check size={16} aria-hidden="true" />}</span>{s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ModeMenu() {
  const [mode, setMode] = useScreenMode()
  const p = usePopover()
  return (
    <div className="rb-gbar-drop">
      <button ref={p.btn} type="button" className="rb-gbar-btn" aria-haspopup="menu" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)}>
        <Monitor size={20} aria-hidden="true" /><span className="rb-gbar-btn-text">화면 설정</span>
      </button>
      {p.open && (
        <ul ref={p.ref} className="cs-pop is-right" role="menu" aria-label="화면 설정">
          {MODES.map(([k, label]) => (
            <li key={k} role="none">
              <button type="button" role="menuitemradio" aria-checked={mode === k} onClick={() => { setMode(k); p.setOpen(false); p.btn.current?.focus() }}>
                <span className="cs-pop-check">{mode === k && <Check size={16} aria-hidden="true" />}</span>{label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 판정 보류 기준 선택. 화면 설정과 같은 메뉴 부품(cs-pop, menuitemradio)을 쓴다
function BasisMenu({ basis, onBasis }) {
  const p = usePopover()
  const cur = BASES.find(([k]) => k === basis) || BASES[0]
  return (
    <div className="rb-gbar-drop">
      <button ref={p.btn} type="button" className="rb-gbar-btn" aria-haspopup="menu" aria-expanded={p.open} aria-label={`판정 기준 ${cur[1]}`} onClick={() => p.setOpen(!p.open)}>
        <Ruler size={20} aria-hidden="true" /><span className="rb-gbar-btn-text">판정 기준 {cur[1]}</span>
      </button>
      {p.open && (
        <ul ref={p.ref} className="cs-pop is-right" role="menu" aria-label="판정 기준">
          {BASES.map(([k, label]) => (
            <li key={k} role="none">
              <button type="button" role="menuitemradio" aria-checked={basis === k} onClick={() => { onBasis(k); p.setOpen(false); p.btn.current?.focus() }}>
                <span className="cs-pop-check">{basis === k && <Check size={16} aria-hidden="true" />}</span>{label} 기준
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Item({ id, screen, onGo }) {
  const n = NAV.find((x) => x.id === id)
  const Icon = ICON[id]
  return (
    <li>
      <a href={`#/${id}`} className={`rb-side-link${screen === id ? ' active' : ''}`} aria-current={screen === id ? 'page' : undefined}
        onClick={(e) => { e.preventDefault(); onGo(id) }}>
        <Icon size={16} aria-hidden="true" className="cs-side-icon" />
        <span className="rb-side-text">{n.label}</span>
      </a>
    </li>
  )
}

export default function AppShell({ basis, onBasis, screen, onGo, sites, siteId, onSite, children }) {
  const [open, setOpen] = useState(false)
  const toggle = useRef(null)
  const side = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    side.current?.querySelector('button, a')?.focus()
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const go = (id) => { setOpen(false); onGo(id) }

  return (
    <>
      <a href="#main" className="rb-skip">본문 바로가기</a>
      <div className="rb-top">
        <header className="rb-gbar">
          <div className="rb-gbar-in">
            <div className="rb-gbar-left">
              <button ref={toggle} type="button" className="rb-gbar-btn rb-gbar-navtoggle" aria-label={open ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
              <a href="#/globe" className="rb-gbar-brand" onClick={(e) => { e.preventDefault(); go('globe') }}>
                <span className="rb-gbar-mark" aria-hidden="true">해</span>
                <span className="rb-gbar-brand-text">연안정비사업 성적표</span>
              </a>
            </div>
            <span />
            <div className="rb-gbar-right">{onBasis && <BasisMenu basis={basis} onBasis={onBasis} />}<ModeMenu /></div>
          </div>
        </header>
      </div>
      <div className="rb-shell has-side">
        <div className="rb-side-wrap">
          {open && <div className="rb-side-dim" onClick={() => setOpen(false)} aria-hidden="true" />}
          <nav ref={side} className={`rb-side${open ? ' is-open' : ''}`} aria-label="주 메뉴">
            <div className="rb-side-scroll">
              <SitePick sites={sites} siteId={siteId} onSite={onSite} />
              <div className="rb-side-groups">
                <div className="rb-side-group">
                  <p className="rb-side-title">선택한 사업지</p>
                  <ul>{SITE.map((id) => <Item key={id} id={id} screen={screen} onGo={go} />)}</ul>
                </div>
                <div className="rb-side-group">
                  <p className="rb-side-title">전체 사업지</p>
                  <ul>{ALL.map((id) => <Item key={id} id={id} screen={screen} onGo={go} />)}</ul>
                </div>
              </div>
            </div>
          </nav>
        </div>
        <main id="main" tabIndex={-1} className="rb-panel">
          <div className="rb-panel-in">{children}</div>
        </main>
      </div>
    </>
  )
}
