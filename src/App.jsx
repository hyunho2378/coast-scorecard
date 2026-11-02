import { useEffect, useState } from 'react'
import AppShell from './shell/AppShell.jsx'
import { useRoute } from './shell/route.js'
import { loadConfig, loadRules, loadSite } from './lib/data.js'
import { StateBlock, Button } from './ui/index.jsx'
import GlobeScene from './scenes/GlobeScene.jsx'
import SitesScreen from './screens/SitesScreen.jsx'
import CardScreen from './screens/CardScreen.jsx'
import MapScene from './scenes/MapScene.jsx'
import CompareScene from './scenes/CompareScene.jsx'
import StormScreen from './screens/StormScreen.jsx'
import SourcesScreen from './screens/SourcesScreen.jsx'

export default function App() {
  const [route, go] = useRoute()
  const [cfg, setCfg] = useState(null)
  const [error, setError] = useState(null)
  const [siteData, setSiteData] = useState({})
  const [rules, setRules] = useState({ status: 'loading' })

  const boot = () => {
    setError(null)
    loadConfig().then((c) => {
      setCfg(c)
      c.sites.forEach((s) => {
        setSiteData((m) => ({ ...m, [s.id]: { status: 'loading' } }))
        loadSite(s).then((d) => setSiteData((m) => ({ ...m, [s.id]: d }))).catch((e) => setSiteData((m) => ({ ...m, [s.id]: { status: 'error', message: String(e) } })))
      })
    }).catch((e) => setError(String(e)))
    loadRules().then(setRules)
  }
  useEffect(boot, [])

  if (error) {
    return (
      <div className="mx-auto max-w-text p-6">
        <StateBlock kind="error" title="설정 파일을 읽지 못했습니다" action={<Button variant="primary" onClick={boot}>다시 읽기</Button>}>{error}</StateBlock>
      </div>
    )
  }
  if (!cfg) return <div className="mx-auto max-w-text p-6"><StateBlock kind="loading">사업지 설정을 읽고 있습니다.</StateBlock></div>

  const site = cfg.sites.find((s) => s.id === route.site) || cfg.sites[0]
  const data = siteData[site.id]
  const onSite = (id) => go(route.screen, id)
  const common = { site, data, rules }

  return (
    <AppShell screen={route.screen} onGo={(id) => go(id)} sites={cfg.sites} siteData={siteData} siteId={site.id} onSite={onSite}>
      {route.screen === 'globe' && <GlobeScene sites={cfg.sites} omm={cfg.omm} schedule={cfg.schedule} onPick={(s) => go('card', s.id)} />}
      {route.screen === 'sites' && <SitesScreen sites={cfg.sites} siteData={siteData} onOpen={(id) => go('card', id)} />}
      {route.screen === 'card' && <CardScreen key={site.id} {...common} />}
      {route.screen === 'map' && <MapScene key={site.id} {...common} />}
      {route.screen === 'compare' && <CompareScene key={site.id} {...common} />}
      {route.screen === 'storm' && <StormScreen sites={cfg.sites} siteData={siteData} storms={cfg.storms} onOpen={(id) => go('map', id)} />}
      {route.screen === 'sources' && <SourcesScreen sites={cfg.sites} siteData={siteData} rules={rules} />}
    </AppShell>
  )
}
