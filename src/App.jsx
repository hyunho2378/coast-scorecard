import { useEffect, useState } from 'react'
import clsx from 'clsx'
import GlobeScene from './scenes/GlobeScene.jsx'
import MapScene from './scenes/MapScene.jsx'
import CompareScene from './scenes/CompareScene.jsx'
import { loadConfig, loadSite } from './lib/data.js'

const TABS = [
  { id: 'globe', label: '지구본' },
  { id: 'map', label: '해안선 지도' },
  { id: 'compare', label: '전후 영상 비교' }
]

export default function App() {
  const [cfg, setCfg] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('scene') || 'globe')
  const [siteId, setSiteId] = useState(() => new URLSearchParams(location.search).get('site') || 'hwajinpo')
  const [siteData, setSiteData] = useState({})

  useEffect(() => { loadConfig().then(setCfg).catch((e) => setError(String(e))) }, [])
  const site = cfg?.sites.find((s) => s.id === siteId) || cfg?.sites[0]

  useEffect(() => {
    if (!site || siteData[site.id]) return
    loadSite(site).then((d) => setSiteData((m) => ({ ...m, [site.id]: d })))
  }, [site]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="p-6 type-body text-danger-text">설정 파일을 읽지 못했습니다. {error}</p>
  if (!cfg) return <p className="p-6 type-body text-text-sec">불러오는 중</p>

  return (
    <div className="flex h-screen min-h-[640px] flex-col bg-page">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <div>
          <h1 className="type-title text-text-pri">연안정비사업 성적표</h1>
          <p className="type-meta text-text-meta">위성으로 보는 사업 전후 해안선 변화</p>
        </div>
        <nav className="flex gap-1 rounded-md bg-canvas p-1" aria-label="장면">
          {TABS.map((t, i) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              className={clsx('pressable rounded-md px-4 py-2 type-strong', tab === t.id ? 'bg-primary text-text-inverse' : 'text-text-sec hover:bg-mute')}>
              {i + 1}. {t.label}
            </button>
          ))}
        </nav>
        {tab !== 'globe' && (
          <div className="flex flex-wrap gap-1" aria-label="사업지">
            {cfg.sites.map((s) => (
              <button key={s.id} type="button" onClick={() => setSiteId(s.id)}
                className={clsx('pressable rounded-md px-3 py-2 type-strong', s.id === site.id ? 'bg-text-pri text-text-inverse' : 'bg-canvas text-text-sec hover:bg-mute')}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </header>
      <main className="min-h-0 flex-1 px-6 pb-6">
        {tab === 'globe' && <GlobeScene sites={cfg.sites} omm={cfg.omm} schedule={cfg.schedule} onPick={(s) => { setSiteId(s.id); setTab('map') }} />}
        {tab === 'map' && <MapScene key={site.id} site={site} data={siteData[site.id]} judge={cfg.judge} />}
        {tab === 'compare' && <CompareScene key={site.id} site={site} data={siteData[site.id]} />}
      </main>
    </div>
  )
}
