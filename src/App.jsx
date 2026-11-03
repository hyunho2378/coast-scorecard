import { useEffect, useMemo, useState } from 'react'
import AppShell from './shell/AppShell.jsx'
import { useRoute } from './shell/route.js'
import { loadConfig, loadRules, loadSite, withBasis } from './lib/data.js'
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
  // 보류 기준 선택. 기본값은 1표준편차, 화면 안 상태로만 둔다
  const [basis, setBasis] = useState('sd1')
  const judged = useMemo(() => {
    if (!cfg) return siteData
    const out = {}
    for (const s of cfg.sites) out[s.id] = withBasis(siteData[s.id], s, rules?.data, basis)
    return out
  }, [cfg, siteData, rules, basis])

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
  const data = judged[site.id]
  const retry = () => readSite(site, rules)
  const common = { site, data, rules, basis, onRetry: retry }

  return (
    <AppShell basis={basis} onBasis={setBasis} screen={route.screen} onGo={(id) => go(id)} sites={cfg.sites} siteId={site.id} onSite={(id) => go(route.screen, id)}>
      {route.screen === 'globe' && <GlobeScene sites={cfg.sites} omm={cfg.omm} onPick={(s) => go('card', s.id)} />}
      {route.screen === 'sites' && <SitesScreen sites={cfg.sites} siteData={judged} rules={rules} onOpen={(id) => go('card', id)} />}
      {route.screen === 'card' && <CardScreen key={site.id} {...common} />}
      {route.screen === 'map' && <MapScene key={site.id} {...common} />}
      {route.screen === 'compare' && <CompareScene key={site.id} {...common} />}
      {route.screen === 'storm' && <StormScreen sites={cfg.sites} siteData={judged} checks={checks} setChecks={setChecks} onOpen={(id) => go('map', id)} />}
      {route.screen === 'sources' && <SourcesScreen sites={cfg.sites} siteData={judged} rules={rules} basis={basis} />}
    </AppShell>
  )
}
