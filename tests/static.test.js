import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const cfg = JSON.parse(fs.readFileSync(`${root}public/config/sites.json`, 'utf8'))

test('사업지 설정의 모든 자료 경로가 상대 경로이고 public 안에 있다', () => {
  for (const s of cfg.sites) for (const list of Object.values(s.files || {})) for (const u of list) {
    assert.ok(!u.startsWith('/'), u)
    assert.ok(fs.existsSync(`${root}public/${u}`), u)
  }
})
test('규칙 파일이 public/data 안에 있다', () => {
  assert.ok(fs.existsSync(`${root}public/data/sensitivity_and_rules_v3.json`))
})
test('소스에 개발 서버 전용 주소 /ext/ 와 앞이 / 인 자료 주소가 없다', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])
  for (const f of walk(`${root}src`).filter((x) => /\.(jsx?|css)$/.test(x))) {
    const t = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(t, /['"`]\/ext\//, f)
    assert.doesNotMatch(t, /fetch\(\s*['"`]\//, f)
  }
})
test('vite 기본 주소는 /coast-scorecard/', () => {
  assert.match(fs.readFileSync(`${root}vite.config.js`, 'utf8'), /base:\s*'\/coast-scorecard\/'/)
})

test('화면 이름: 점검 순서 목록(식별자 storm 그대로), 사이트 이름 연안정비사업 성적표', async () => {
  const { NAV } = await import('../src/shell/route.js')
  assert.deepEqual(NAV.find((n) => n.id === 'storm'), { id: 'storm', label: '점검 순서 목록' })
  assert.equal(NAV.length, 7)
  const storm = fs.readFileSync(`${root}src/screens/StormScreen.jsx`, 'utf8')
  assert.match(storm, /title="점검 순서 목록"/)
  assert.match(storm, /선택한 기준 장면과 비교 장면의 변화가 큰 가로선부터 점검 순서를 매깁니다\./)
  assert.match(fs.readFileSync(`${root}index.html`, 'utf8'), /<title>연안정비사업 성적표<\/title>/)
  assert.match(fs.readFileSync(`${root}src/shell/AppShell.jsx`, 'utf8'), />연안정비사업 성적표</)
  assert.match(fs.readFileSync(`${root}README.md`, 'utf8'), /^# 연안정비사업 성적표/)
})
test('소스와 README에 폭풍, 파고, 판정 가능, 판정 전진, 해안선 성적표 문구가 없다', () => {
  const files = []
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p); else if (/\.(jsx?|css|html|md)$/.test(f.name)) files.push(p) } }
  walk(`${root}src`); files.push(`${root}README.md`, `${root}index.html`)
  for (const p of files) assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /폭풍|파고|판정 가능|판정 전진|판정 후퇴|해안선 성적표/, p)
})
