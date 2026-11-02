// 담당자 콘솔 셸. 1024 이상은 왼쪽 메뉴 고정, 그보다 좁으면 메뉴 단추로 여는 서랍
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Globe2, ListChecks, Map, Menu, Columns2, FileText, BookOpen, LayoutGrid, X } from 'lucide-react'
import { NAV } from './route.js'

const ICON = { globe: Globe2, sites: LayoutGrid, card: FileText, map: Map, compare: Columns2, storm: ListChecks, sources: BookOpen }
const DOT = { ready: 'bg-primary', loading: 'bg-text-ter', empty: 'bg-text-ter', error: 'bg-danger' }
const SITE_SCREENS = ['card', 'map', 'compare']

function NavList({ screen, onGo }) {
  return (
    <ul className="flex flex-col gap-1">
      {NAV.map((n) => {
        const Icon = ICON[n.id]
        const on = n.id === screen
        return (
          <li key={n.id}>
            <a href={`#/${n.id}`} onClick={(e) => { e.preventDefault(); onGo(n.id) }} aria-current={on ? 'page' : undefined}
              className={clsx('pressable flex min-h-11 items-center gap-3 rounded-sm px-3 type-strong', on ? 'bg-primary-soft text-primary-text' : 'text-text-sec hover:bg-canvas hover:text-text-pri')}>
              <Icon size={18} aria-hidden="true" />
              <span>{n.label}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

function Brand() {
  return (
    <div className="px-3">
      <p className="type-h3 text-text-pri">해안선 성적표</p>
      <p className="type-meta text-text-meta">연안정비사업 사후관리 콘솔</p>
    </div>
  )
}

export default function AppShell({ screen, onGo, sites, siteData, siteId, onSite, children }) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef(null)
  const menuBtn = useRef(null)
  const showSites = SITE_SCREENS.includes(screen)

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = (id) => { setOpen(false); onGo(id) }

  return (
    <div className="flex min-h-screen bg-page lg:h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-text-inverse">본문 바로가기</a>
      <nav aria-label="주 메뉴" className="hidden w-rail shrink-0 flex-col gap-6 bg-rail px-3 py-6 lg:flex">
        <Brand />
        <NavList screen={screen} onGo={go} />
        <p className="mt-auto px-3 type-meta text-text-meta">모든 판정 값은 시험값입니다.</p>
      </nav>

      {open && (
        <div className="fixed inset-0 z-drawer lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-page/80" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav aria-label="주 메뉴" role="dialog" aria-modal="true" className="animate-slide-in-left absolute inset-y-0 left-0 flex w-rail flex-col gap-6 bg-rail px-3 py-5 shadow-lg">
            <div className="flex items-center justify-between">
              <Brand />
              <button ref={closeRef} type="button" onClick={() => { setOpen(false); menuBtn.current?.focus() }} aria-label="메뉴 닫기"
                className="pressable inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-sec hover:bg-canvas"><X size={20} aria-hidden="true" /></button>
            </div>
            <NavList screen={screen} onGo={go} />
          </nav>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-topbar items-center gap-3 bg-page px-4 py-2 md:px-6">
          <button ref={menuBtn} type="button" onClick={() => setOpen(true)} aria-label="메뉴 열기"
            className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-canvas text-text-pri lg:hidden"><Menu size={20} aria-hidden="true" /></button>
          <p className="shrink-0 type-strong text-text-pri lg:hidden">해안선 성적표</p>
          {showSites ? (
            <div role="group" aria-label="사업지 선택" className="no-scrollbar -my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
              {sites.map((s) => {
                const st = siteData[s.id]?.status || 'loading'
                const on = s.id === siteId
                return (
                  <button key={s.id} type="button" onClick={() => onSite(s.id)} aria-pressed={on}
                    className={clsx('pressable inline-flex min-h-11 shrink-0 items-center gap-2 rounded-sm px-3 type-strong', on ? 'bg-primary text-text-inverse' : 'bg-canvas text-text-sec hover:bg-mute hover:text-text-pri')}>
                    <span className={clsx('h-2 w-2 rounded-full', on ? 'bg-text-inverse' : DOT[st])} aria-hidden="true" />
                    {s.name}
                  </button>
                )
              })}
            </div>
          ) : <span className="flex-1" />}
        </div>
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2 md:px-6 lg:px-8">
          <div key={screen} className="page-enter mx-auto flex h-full max-w-page flex-col gap-5">{children}</div>
        </main>
      </div>
    </div>
  )
}
