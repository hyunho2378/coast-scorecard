// 재현 일치 시험 자료 만들기: 사업지 분석 창의 장면 원값(green, nir, scl)을 tests/fixtures/repro_<사업지>.bin.gz 로 저장
// 실행: node scripts/repro_fixture.mjs banam
import fs from 'node:fs'
import zlib from 'node:zlib'
import { fromUrl } from 'geotiff'
import { loadReproScenes } from '../src/engine/repro.js'
const id = process.argv[2] || 'banam'
const site = JSON.parse(fs.readFileSync('public/config/sites.json', 'utf8')).sites.find((s) => s.id === id)
const rules = JSON.parse(fs.readFileSync('public/data/sensitivity_and_rules_v3.json', 'utf8'))
const openTiff = (h) => fromUrl(h, { allowFullFile: false })
const raw = await loadReproScenes({ ...site.repro, periods: rules.scene_rule.sites[id].periods }, { openTiff })
const head = raw.map((s) => ({ id: s.id, period: s.period, date: s.date, cloud: s.cloud, n: s.green.length, sclW: s.sclW, sclH: s.sclH }))
const parts = raw.flatMap((s) => [Buffer.from(Uint16Array.from(s.green).buffer), Buffer.from(Uint16Array.from(s.nir).buffer), Buffer.from(Uint8Array.from(s.scl).buffer)])
const hj = Buffer.from(JSON.stringify(head))
const len = Buffer.alloc(4); len.writeUInt32LE(hj.length)
fs.mkdirSync('tests/fixtures', { recursive: true })
fs.writeFileSync(`tests/fixtures/repro_${id}.bin.gz`, zlib.gzipSync(Buffer.concat([len, hj, ...parts]), { level: 9 }))
console.log(id, fs.statSync(`tests/fixtures/repro_${id}.bin.gz`).size)
