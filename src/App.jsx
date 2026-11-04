import { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from './shell/AppShell.jsx'
import { useRoute } from './shell/route.js'
import { loadConfig, loadRules, loadSite, withBasis } from './lib/data.js'
import { mergeRules, reproToSite, runToSite } from './lib/runs.js'
import { Box, ErrorLine, Loading } from './ui/index.jsx'
import ErrorBoundary from './ui/ErrorBoundary.jsx'
import HomeScreen from './screens/HomeScreen.jsx'
import AnalyzeScreen from './screens/AnalyzeScreen.jsx'
import CardScreen from './screens/CardScreen.jsx'
import MapScene from './scenes/MapScene.jsx'
import CompareScene from './scenes/CompareScene.jsx'
import StormScreen from './screens/StormScreen.jsx'
import HistoryScreen from './screens/HistoryScreen.jsx'
import RulesScreen from './screens/RulesScreen.jsx'
import DocsScreen from './screens/DocsScreen.jsx'
import SourcesScreen from './screens/SourcesScreen.jsx'

// 운영 기준 기본값. 화면 안 상태로만 두고 새로고침하면 처음 값으로 돌아간다
export const DEFAULT_SETTINGS = { basis: 'sd1', minScenes: 2, maxScenes: 3, maxCloud: 10, spacing: 100, w0: 50, offset: 10, slope: 0.17, tide: 0.3, other: 30 }

export default function App() {
  const [route, go] = useRoute()
  const [cfg, setCfg] = useState(null)
  const [error, setError] = useState(null)
  const [siteData, setSiteData] = useState({})
  const [rules, setRules] = useState({ status: 'loading' })
  const [checks, setChecks] = useState({})
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [runs, setRuns] = useState([])
  const [job, setJob] = useState(null)
  const abort = useRef(null)

  const merged = useMemo(() => (rules?.data ? { ...rules, data: mergeRules(rules.data, runs) } : rules), [rules, runs])
  const allSites = useMemo(() => (cfg ? [...cfg.sites, ...runs.map((r) => r.site)] : []), [cfg, runs])
  const judged = useMemo(() => {
    const out = {}
    for (const s of cfg?.sites || []) out[s.id] = withBasis(siteData[s.id], s, merged?.data, settings.basis, settings.minScenes)
    for (const r of runs) out[r.site.id] = withBasis(r.data, r.site, merged?.data, settings.basis, settings.minScenes)
    return out
  }, [cfg, siteData, runs, merged, settings.basis, settings.minScenes])

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

  // 새 사업지 분석. 진행 상태는 App 이 들고 있어 다른 화면으로 옮겨도 계속 돈다
  const runCount = useRef(0)
  const startRun = async (params, name) => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setJob({ status: 'running', stage: 0, done: 0, total: 2, params, name })
    try {
      if (params.mode === 'repro') {
        const { reproInBrowser } = await import('./engine/browser.js')
        const base = cfg.sites.find((s) => s.id === params.siteId)
        const out = await reproInBrowser(params.cfg, { signal: ctl.signal, onProgress: (e) => setJob((j) => ({ ...j, stage: e.stage, done: e.done, total: e.total })) })
        runCount.current += 1
        const id = `run${runCount.current}`
        const sd = siteData[base.id]
        const run = reproToSite(out, { id, name: name || `${base.name} 재현 기준`, base, boardRule: rules?.data?.site_rules?.[base.id], structureIds: params.structureIds, images: { before: sd?.before, after: sd?.after } })
        setRuns((xs) => [...xs, run])
        setJob({ status: 'done', id, params: { mode: 'repro', siteId: base.id }, name: run.site.name, meta: run.data.run.meta })
        return id
      }
      const { analyzeInBrowser } = await import('./engine/browser.js')
      const result = await analyzeInBrowser(params, { signal: ctl.signal, onProgress: (e) => setJob((j) => ({ ...j, stage: e.stage, done: e.done, total: e.total })) })
      runCount.current += 1
      const id = `run${runCount.current}`
      const run = runToSite(result, { id, name: name || `새 사업지 ${runCount.current}`, korea: rules?.data?.site_rules?.banam })
      setRuns((xs) => [...xs, run])
      setJob({ status: 'done', id, params, name: run.site.name, meta: result.meta })
      return id
    } catch (e) {
      if (e.name === 'AbortError') { setJob(null); return null }
      setJob({ status: 'error', kind: e.kind || 'network', message: String(e.message || e), params, name })
      return null
    }
  }
  const stopRun = () => { abort.current?.abort(); setJob(null) }
  const addRun = (run) => {
    runCount.current += 1
    const id = `run${runCount.current}`
    setRuns((xs) => [...xs, { ...run, site: { ...run.site, id } }])
    return id
  }
  const removeRun = (id) => setRuns((xs) => xs.filter((r) => r.site.id !== id))

  if (error) return <main className="rb-panel-in"><Box flush><ErrorLine onRetry={boot}>사업지 설정 파일을 읽지 못했습니다.</ErrorLine></Box></main>
  if (!cfg) return <main className="rb-panel-in"><Box flush><Loading /></Box></main>

  const site = allSites.find((s) => s.id === route.site) || allSites[0]
  const data = judged[site.id]
  const isRun = Boolean(site.run)
  const retry = () => (isRun ? null : readSite(site, rules))
  const common = { site, data, rules: merged, basis: settings.basis, settings, onRetry: retry }

  return (
    <AppShell screen={route.screen} onGo={(id) => go(id)} sites={allSites} siteId={site.id} siteName={site.name} onSite={(id) => go(route.screen, id)} busy={job?.status === 'running'}>
      <ErrorBoundary resetKey={`${route.screen}:${site.id}`}>
      {route.screen === 'home' && <HomeScreen sites={allSites} siteData={judged} rules={merged} site={site} settings={settings} onSelect={(id) => go('home', id)} onOpen={(id, screen = 'card') => go(screen, id)} />}
      {route.screen === 'analyze' && <AnalyzeScreen sites={allSites} siteData={judged} rules={merged} settings={settings} job={job} onRun={startRun} onStop={stopRun} onOpen={(id, screen = 'card') => go(screen, id)} />}
      {route.screen === 'card' && <CardScreen key={site.id} {...common} />}
      {route.screen === 'map' && <MapScene key={site.id} {...common} />}
      {route.screen === 'compare' && <CompareScene key={site.id} {...common} />}
      {route.screen === 'storm' && <StormScreen sites={allSites} siteData={judged} checks={checks} setChecks={setChecks} onOpen={(id) => go('map', id)} />}
      {route.screen === 'history' && <HistoryScreen runs={runs} siteData={judged} onOpen={(id, screen = 'card') => go(screen, id)} onRemove={removeRun} onAdd={addRun} />}
      {route.screen === 'rules' && <RulesScreen sites={allSites} siteData={judged} rules={merged} settings={settings} setSettings={setSettings} siteId={site.id} onSite={(id) => go('rules', id)} />}
      {route.screen === 'docs' && <DocsScreen sites={allSites} siteData={judged} rules={merged} settings={settings} site={site} onSite={(id) => go('docs', id)} />}
      {route.screen === 'sources' && <SourcesScreen sites={cfg.sites} siteData={judged} rules={merged} basis={settings.basis} />}
      </ErrorBoundary>
    </AppShell>
  )
}
