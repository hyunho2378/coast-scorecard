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

test('정보 구조: 업무, 기록, 외부 묶음과 화면 10개, 사이트 이름 연안정비사업 성적표', async () => {
  const { NAV, GROUPS } = await import('../src/shell/route.js')
  assert.deepEqual(GROUPS.map((g) => g[1]), ['업무', '기록', '외부'])
  assert.deepEqual(NAV.filter((n) => n.group === 'work').map((n) => n.label), ['현황판', '사업지 분석', '판정 카드', '해안선 지도', '전후 영상', '점검 순서 목록'])
  assert.deepEqual(NAV.filter((n) => n.group === 'record').map((n) => n.label), ['분석 기록', '운영 기준', '문서 센터'])
  assert.deepEqual(NAV.filter((n) => n.group === 'outside').map((n) => n.label), ['자료와 출처'])
  assert.equal(NAV[0].id, 'home')
  assert.match(fs.readFileSync(`${root}index.html`, 'utf8'), /<title>연안정비사업 성적표<\/title>/)
  const shell = fs.readFileSync(`${root}src/shell/AppShell.jsx`, 'utf8')
  assert.match(shell, />연안정비사업 성적표</)
  assert.match(shell, /새 사업지 분석/)
  assert.match(fs.readFileSync(`${root}README.md`, 'utf8'), /^# 연안정비사업 성적표/)
})
test('화면에 서비스 소개, 이용 안내 문단, 자기 제한 문구가 없다', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])
  for (const f of walk(`${root}src`).filter((x) => /\.jsx$/.test(x))) {
    const t = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(t, /서비스 안내|이용 순서|className="cs-text"|근거|시험값|샘플/, f)
  }
})
test('소스와 README에 폭풍, 파고, 판정 가능, 판정 전진, 해안선 성적표 문구가 없다', () => {
  const files = []
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p); else if (/\.(jsx?|css|html|md)$/.test(f.name)) files.push(p) } }
  walk(`${root}src`); files.push(`${root}README.md`, `${root}index.html`)
  for (const p of files) assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /폭풍|파고|판정 가능|판정 전진|판정 후퇴|해안선 성적표/, p)
})

test('화면 소스에 기대 수 문장과 1표준편차, 95% 표기가 없다', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])
  for (const f of walk(`${root}src`).filter((x) => /\.jsx?$/.test(x))) {
    const t = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
    assert.doesNotMatch(t, /기대 수|오차만으로|1표준편차|['"`]95%/, f)
  }
})
test('보류 기준 선택지 이름: 22.9 m(기본)과 44.9 m(엄격)', () => {
  const t = fs.readFileSync(`${root}src/screens/RulesScreen.jsx`, 'utf8')
  assert.match(t, / m\(기본\)`/); assert.match(t, / m\(엄격\)`/)
})
test('판정 카드 머리: 보류 기준 값만(괄호 설명 없음)', () => {
  const t = fs.readFileSync(`${root}src/screens/CardScreen.jsx`, 'utf8')
  assert.match(t, /<span>보류 기준 \{thr\}\{'\\u00a0'\}m<\/span>/)
})
test('사업지 분석: 1023 폭 이하에서 분석 조건을 지도보다 앞에, 지도 단추는 왼쪽 위', () => {
  const css = fs.readFileSync(`${root}src/styles.css`, 'utf8')
  assert.match(css, /@media \(max-width: 1023px\) \{\s*\.cs-split\.is-tool > \.cs-col \{ display: contents; \}\s*\.cs-split\.is-tool > \.cs-col > :first-child \{ order: -1; \}/)
  const a = fs.readFileSync(`${root}src/screens/AnalyzeScreen.jsx`, 'utf8')
  assert.match(a, /`구조물 \$\{presetIds\.length\}개 불러오기`/)
  assert.doesNotMatch(a, />\{repro \? `구조물 의심 가로선 \$\{presetIds\.length\}개 불러오기`/)
})

test('화면 소스에 등급 변경 확률과 거짓 판정, 기대 수, 1표준편차, 95% 문구가 없다(주석 포함)', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])
  const files = walk(`${root}src`).filter((x) => /\.(jsx?|css|html)$/.test(x)).concat([`${root}index.html`])
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /등급 변경|변경 확률|거짓 판정|기대 수|1표준편차|95%/, f)
})
test('판정 카드 상세 탭: 오차 유형별 표에 등급 변경 열 없음(합계까지 네 묶음)', () => {
  const t = fs.readFileSync(`${root}src/screens/CardScreen.jsx`, 'utf8')
  assert.doesNotMatch(t, /pGrade/)
  assert.match(t, /className="is-group">합계<\/th><\/tr>/)
  assert.match(t, /Array\.from\(\{ length: 4 \}/)
})
test('자료와 출처: 거짓 판정 표 대신 같은 해 장면쌍 위치 차이 한 줄(poc8 값)', () => {
  const t = fs.readFileSync(`${root}src/screens/SourcesScreen.jsx`, 'utf8')
  assert.doesNotMatch(t, /falsePositiveRows|x\.rate|fp\.map/)
  assert.match(t, /export const SAMEPAIR_LINE = '같은 해 장면쌍 위치 차이\(구조물 의심 제외 135쌍\): 표준편차 4\.03\\u00a0m, 95백분위 7\.83\\u00a0m, 최대 10\.6\\u00a0m'/)
  assert.match(t, /\{SAMEPAIR_LINE\}/)
})

test('화면 소스에 옛 등급 이름(판정 보류, 기준 초과)이 없다(주석 포함)', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])
  const files = walk(`${root}src`).filter((x) => /\.(jsx?|css|html)$/.test(x)).concat([`${root}index.html`])
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /판정 보류|기준 초과/, f)
})
test('큰 숫자 세 칸: 라벨은 서류 등급 이름 하나만(TIER)', () => {
  const t = fs.readFileSync(`${root}src/parts/transect.jsx`, 'utf8')
  for (const k of ['exceed', 'struct', 'hold']) assert.match(t, new RegExp(`<dt>\\{TIER\\.${k}\\}</dt>`))
  assert.doesNotMatch(t, /cs-big-tier/)
  assert.match(t, /\/>변화 확인 전진<\/span>/); assert.match(t, /\/>정규 측량 일정<\/span>/)
})
test('점수 라벨: 위성 값 기준 참고 점수, 별표 10 탭에 확정 점수 안내 한 줄', () => {
  assert.match(fs.readFileSync(`${root}src/parts/transect.jsx`, 'utf8'), /<dt>위성 값 기준 참고 점수<\/dt>/)
  assert.match(fs.readFileSync(`${root}src/screens/CardScreen.jsx`, 'utf8'), /<Note>위성 값 기준 참고 점수, 현장 측량값 입력 시 확정 점수로 바뀜<\/Note>/)
})
test('사업지 분석: 현황판 대조 줄은 재현 기준 결과에서만 계산', () => {
  const a = fs.readFileSync(`${root}src/screens/AnalyzeScreen.jsx`, 'utf8')
  assert.match(a, /const boardBase = jobRepro && resData\?\.status === 'ready'/)
  assert.match(a, /\{diffLine && <p className="cs-repro-note cs-repro-diff">\{diffLine\}<\/p>\}/)
})
