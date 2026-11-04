// 재현 기준 확인: 현황판 사업지 가로선 파일 값과 엔진 재계산 값을 가로선별로 견준다
// 실행: node scripts/repro_check.mjs banam
import fs from 'node:fs'
import { fromUrl } from 'geotiff'
import { runRepro, compareWithBoard } from '../src/engine/repro.js'
import { judgeRows, summarize } from '../src/lib/judge.js'
const id = process.argv[2] || 'banam'
const sites = JSON.parse(fs.readFileSync('public/config/sites.json', 'utf8')).sites
const site = sites.find((s) => s.id === id)
const rules = JSON.parse(fs.readFileSync('public/data/sensitivity_and_rules_v3.json', 'utf8'))
const tr = JSON.parse(fs.readFileSync(`public/data/${id}/transects.geojson`, 'utf8'))
const cache = new Map()
const openTiff = (h) => { if (!cache.has(h)) cache.set(h, fromUrl(h, { allowFullFile: false })); return cache.get(h) }
const cfg = { ...site.repro, periods: rules.scene_rule.sites[id].periods, features: tr.features }
const out = await runRepro(cfg, { openTiff, onProgress: (p) => process.stderr.write(`${p.name} ${p.done}/${p.total}\r`) })
const cmp = compareWithBoard(out.base, tr.features)
const rule = rules.site_rules[id]
const rows = judgeRows(out.base, rule, cfg.periods)
const s = summarize(rows)
const max = Math.max(...cmp.map((c) => (c.diff === null ? Infinity : Math.abs(c.diff))))
console.log(JSON.stringify({ id, thr: out.measured.scenes.map((x) => [x.id, x.thr]), thrMed: out.measured.thrMed, total: s.total, judgeable: s.judgeable, held: s.held, excluded: s.excluded, maxChangeDiff: max, maxSceneDiff: Math.max(...cmp.map((c) => c.sceneMax ?? Infinity)) }))
if (process.argv.includes('--rows')) for (const c of cmp) console.log([c.id, c.board, c.engine, c.diff, c.sceneMax].join('\t'))
if (process.argv.includes("--scenes")) { const by = new Map(tr.features.map((f) => [f.properties.id, f.properties.dist_m])); for (const r of out.base) { const b = by.get(r.id); for (const k of Object.keys(r.dist)) if (r.dist[k] !== b[k]) console.log(r.id, k, "engine", r.dist[k], "board", b[k]) } }
