// 분석 결과 폴더(erosion_poc2)에서 앱이 읽는 파일만 public/data/ 로 복사한다. 목록은 public/config/sites.json 의 files 항목과 규칙 파일
// 실행: COAST_POC2_DIR=<분석 폴더> node scripts/copy_data.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = process.env.COAST_POC2_DIR
if (!SRC) { console.error('COAST_POC2_DIR 환경 변수로 분석 폴더를 지정합니다.'); process.exit(1) }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'public/config/sites.json'), 'utf8'))
// 화면 경로(data/...)와 분석 폴더 안 원본 경로
const MAP = { 'data/sandmotor/sandmotor_spring_vs_jarkus_rows.json': 'sites/sandmotor_spring_vs_jarkus_rows.json' }
const want = new Set(['data/sensitivity_and_rules_v3.json'])
for (const s of cfg.sites) for (const list of Object.values(s.files || {})) for (const u of list) want.add(u)
let total = 0
for (const u of want) {
  const from = path.join(SRC, MAP[u] || u.replace(/^data\//, ''))
  const to = path.join(root, 'public', u)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  const n = fs.statSync(to).size
  total += n
  console.log(`${String(n).padStart(9)} ${u}`)
}
console.log(`${String(total).padStart(9)} 합계 ${want.size}개`)
