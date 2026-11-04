// 화면이 통째로 비는 문제 재발 방지. 새 분석 뒤 현황판 사업지 탭 전환에서 지도 갱신이 새 지도의 자료 원본보다 먼저 돌던 오류
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mapReady, boundaryFromError, boundaryFromProps, boundaryRetry } from '../src/lib/guard.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (f) => fs.readFileSync(`${root}${f}`, 'utf8')
const fakeMap = (sources, layers = []) => ({ getSource: (id) => (sources.includes(id) ? { setData() {} } : undefined), getLayer: (id) => (layers.includes(id) ? {} : undefined) })

test('지도 갱신 확인: 새 지도에 자료 원본이 생기기 전에는 갱신하지 않는다', () => {
  assert.equal(mapReady(fakeMap([]), true, ['base', 'last', 'transects']), false)
  assert.equal(mapReady(fakeMap(['base']), true, ['base', 'last', 'transects']), false)
  assert.equal(mapReady(fakeMap(['base', 'last', 'transects']), true, ['base', 'last', 'transects']), true)
  assert.equal(mapReady(fakeMap(['base', 'last', 'transects']), false, ['base']), false)
  assert.equal(mapReady(null, true, ['base']), false)
  assert.equal(mapReady(fakeMap([], []), true, [], ['tr-sel']), false)
  assert.equal(mapReady(fakeMap([], ['tr-sel', 'tr-sel-halo']), true, [], ['tr-sel', 'tr-sel-halo']), true)
})
test('지도 부품 세 곳이 setData 와 setFilter 전에 mapReady 로 확인한다', () => {
  const t = read('src/parts/transect.jsx')
  assert.match(t, /if \(!ready \|\| !mapReady\(m, loaded, \['base', 'last', 'transects'\]\)\) return\s*\n\s*m\.getSource\('base'\)\.setData/)
  assert.match(t, /if \(!mapReady\(m, loaded, \[\], \['tr-sel', 'tr-sel-halo'\]\)\) return\s*\n[^\n]*\n\s*m\.setFilter\('tr-sel'/)
  const a = read('src/screens/AnalyzeScreen.jsx')
  assert.match(a, /mapReady\(m, loaded, \['point', 'box', 'transects'\]\)/)
  assert.match(a, /mapReady\(m, loaded, \['polys', 'ring'\]\)/)
  assert.match(read('src/scenes/MapScene.jsx'), /mapReady\(m, loaded, \['base', 'current', 'transects'\]\)/)
  for (const f of ['src/parts/transect.jsx', 'src/screens/AnalyzeScreen.jsx', 'src/scenes/MapScene.jsx']) {
    assert.doesNotMatch(read(f), /if \(!loaded \|\| !m\) return/, f)
  }
})
test('오류 경계 상태: 오류가 나면 안내, 화면이나 사업지가 바뀌면 비움, 다시 시도는 새로 그림', () => {
  const s0 = { error: null, key: 'home:banam' }
  const s1 = { ...s0, ...boundaryFromError(new TypeError('x')) }
  assert.ok(s1.error instanceof TypeError)
  assert.equal(boundaryFromProps({ resetKey: 'home:banam' }, s1), null)
  assert.deepEqual(boundaryFromProps({ resetKey: 'home:run1' }, s1), { error: null, key: 'home:run1' })
  assert.deepEqual(boundaryRetry({ ...s1, round: 2 }), { error: null, round: 3 })
  assert.deepEqual(boundaryRetry(s1), { error: null, round: 1 })
})
test('App 이 모든 화면을 오류 경계로 감싸고 화면과 사업지로 초기화한다', () => {
  const app = read('src/App.jsx')
  const open = app.indexOf('<ErrorBoundary resetKey={`${route.screen}:${site.id}`}>')
  const close = app.indexOf('</ErrorBoundary>')
  assert.ok(open > 0 && close > open)
  const inner = app.slice(open, close)
  for (const s of ['home', 'analyze', 'card', 'map', 'compare', 'storm', 'history', 'rules', 'docs', 'sources']) assert.match(inner, new RegExp(`route\\.screen === '${s}'`), s)
  const b = read('src/ui/ErrorBoundary.jsx')
  assert.match(b, /static getDerivedStateFromError/)
  assert.match(b, /retryLabel="다시 시도"/)
  assert.match(b, /BOUNDARY_TEXT = '화면을 그리지 못했습니다\./)
  assert.match(read('src/ui/index.jsx'), /retryLabel = '다시 읽기'/)
})
