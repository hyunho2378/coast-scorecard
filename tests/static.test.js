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
