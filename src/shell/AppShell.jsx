// 전역 틀. 미리 담당자 콘솔 배치를 따른다: 왼쪽 메뉴(맨 위 이름, 사업지 선택, 업무와 기록, 외부 묶음)가 화면 높이 전체를 쓰고,
// 오른쪽은 한 줄 상단 띠(현재 화면 이름, 오른쪽 끝 주 행동 단추) 아래 둥근 흰 판. 색과 부품은 KRDS 변수와 공공 깃랩 shell.css
// 768 미만은 왼쪽 메뉴를 숨기고 상단 띠의 메뉴 단추로 연다
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, ChevronsUpDown, Columns2, FileText, FolderOpen, History, LayoutDashboard, ListChecks, Map, Menu, Monitor, Plus, Radar, Settings2, X } from 'lucide-react'
import { GROUPS, NAV } from './route.js'
import { MODES, useScreenMode } from './screenMode.js'
import { usePopover } from '../ui/popover.js'

export const ICON = { home: LayoutDashboard, analyze: Radar, card: FileText, map: Map, compare: Columns2, storm: ListChecks, history: History, rules: Settings2, docs: FolderOpen, sources: BookOpen }

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

export default function AppShell({ screen, onGo, sites, siteId, onSite, siteName, busy, children }) {
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
  const cur = NAV.find((n) => n.id === screen) || NAV[0]
  const CurIcon = ICON[cur.id]

  return (
    <>
      <a href="#main" className="rb-skip">본문 바로가기</a>
      <div className="cs-app">
        <div className="rb-side-wrap cs-side-wrap">
          {open && <div className="rb-side-dim" onClick={() => setOpen(false)} aria-hidden="true" />}
          <nav ref={side} className={`rb-side cs-side${open ? ' is-open' : ''}`} aria-label="주 메뉴">
            <a href="#/home" className="cs-brand" onClick={(e) => { e.preventDefault(); go('home') }}>
              <span className="rb-gbar-mark" aria-hidden="true">해</span>
              <span className="cs-brand-text">연안정비사업 성적표</span>
            </a>
            <div className="rb-side-scroll">
              <SitePick sites={sites} siteId={siteId} onSite={(id) => { setOpen(false); onSite(id) }} />
              <div className="rb-side-groups">
                {GROUPS.map(([g, label]) => (
                  <section key={g} className="rb-side-group" aria-label={label}>
                    <h2 className="rb-side-title">{label}</h2>
                    <ul>{NAV.filter((n) => n.group === g).map((n) => <Item key={n.id} id={n.id} screen={screen} onGo={go} />)}</ul>
                  </section>
                ))}
              </div>
            </div>
          </nav>
        </div>
        <div className="cs-main">
          <header className="cs-top">
            <button ref={toggle} type="button" className="rb-gbar-btn rb-gbar-navtoggle" aria-label={open ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
            <p className="cs-top-where">
              <CurIcon size={16} aria-hidden="true" className="cs-side-icon" />
              <span className="cs-top-name">{cur.label}</span>
              {cur.site && siteName && <><ChevronRight size={14} aria-hidden="true" className="cs-side-icon" /><span className="cs-top-site">{siteName}</span></>}
            </p>
            <div className="cs-top-right">
              <ModeMenu />
              <button type="button" className="krds-btn small primary cs-top-action" onClick={() => go('analyze')} aria-busy={busy || undefined}>
                <Plus size={16} aria-hidden="true" /><span>새 사업지 분석</span>
              </button>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="rb-panel cs-panel">
            <div className="rb-panel-in">{children}</div>
          </main>
        </div>
      </div>
    </>
  )
}
