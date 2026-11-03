import { useEffect, useState } from 'react'
import AppShell from './shell/AppShell.jsx'
import { useRoute } from './shell/route.js'
import { loadConfig, loadRules, loadSite } from './lib/data.js'
import { Box, ErrorLine, Loading } from './ui/index.jsx'
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
  const [checks, setChecks] = useState({})

  const readSite = (s, r) => {
    setSiteData((m) => ({ ...m, [s.id]: { status: 'loading' } }))
    loadSite(s, r?.data).then((d) => setSiteData((m) => ({ ...m, [s.id]: d })))
      .catch((e) => setSiteData((m) => ({ ...m, [s.id]: { status: 'error', message: String(e) } })))
  }
  const boot = () => {
    setError(null)
    Promise.all([loadConfig(), loadRules()]).then(([c, r]) => {
      setCfg(c); setRules(r)
      c.sites.forEach((s) => readSite(s, r))
    }).catch((e) => setError(String(e)))
  }
  useEffect(boot, [])

  if (error) return <main className="rb-panel-in"><Box flush><ErrorLine onRetry={boot}>사업지 설정 파일을 읽지 못했습니다.</ErrorLine></Box></main>
  if (!cfg) return <main className="rb-panel-in"><Box flush><Loading /></Box></main>

  const site = cfg.sites.find((s) => s.id === route.site) || cfg.sites[0]
  const data = siteData[site.id]
  const retry = () => readSite(site, rules)
  const common = { site, data, rules, onRetry: retry }

  return (
    <AppShell screen={route.screen} onGo={(id) => go(id)} sites={cfg.sites} siteId={site.id} onSite={(id) => go(route.screen, id)}>
      {route.screen === 'globe' && <GlobeScene sites={cfg.sites} omm={cfg.omm} onPick={(s) => go('card', s.id)} />}
      {route.screen === 'sites' && <SitesScreen sites={cfg.sites} siteData={siteData} rules={rules} onOpen={(id) => go('card', id)} />}
      {route.screen === 'card' && <CardScreen key={site.id} {...common} />}
      {route.screen === 'map' && <MapScene key={site.id} {...common} />}
      {route.screen === 'compare' && <CompareScene key={site.id} {...common} />}
      {route.screen === 'storm' && <StormScreen sites={cfg.sites} siteData={siteData} checks={checks} setChecks={setChecks} onOpen={(id) => go('map', id)} />}
      {route.screen === 'sources' && <SourcesScreen sites={cfg.sites} siteData={siteData} rules={rules} />}
    </AppShell>
  )
}
