// 재현 일치 시험: 현황판 사업지 가로선 파일 값과 재현 기준 엔진 값을 가로선별로 견준다(차이 1 m 이내)
// 시험 자료는 scripts/repro_fixture.mjs 가 저장한 장면 원값(분석 창의 green, nir, scl)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { reproFromScenes, compareWithBoard, otsuCenter, roundHalfEven, shoreDist, REPRO_SET } from '../src/engine/repro.js'
import { judgeRows, summarize } from '../src/lib/judge.js'
import { normalizeTransects } from '../src/lib/loader-core.js'
import { reproToSite, runConditions, runLine, conditionsCsvHead } from '../src/lib/runs.js'
import { surveyCsv } from '../src/lib/survey.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => JSON.parse(fs.readFileSync(root + p, 'utf8'))
const sites = read('public/config/sites.json').sites
const rules = read('public/data/sensitivity_and_rules_v3.json')

function fixture(id) {
  const buf = zlib.gunzipSync(fs.readFileSync(`${root}tests/fixtures/repro_${id}.bin.gz`))
  const hl = buf.readUInt32LE(0)
  const head = JSON.parse(buf.subarray(4, 4 + hl).toString())
  let o = 4 + hl
  const take = (n, T) => { const a = new T(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + n * T.BYTES_PER_ELEMENT)); o += n * T.BYTES_PER_ELEMENT; return a }
  return head.map((h) => ({ ...h, green: take(h.n, Uint16Array), nir: take(h.n, Uint16Array), scl: take(h.sclW * h.sclH, Uint8Array) }))
}

for (const id of ['banam', 'jinjin']) {
  test(`재현 기준 ${id}: 가로선별 이동 거리 차이 1 m 이내, 판정 수 같음`, () => {
    const site = sites.find((s) => s.id === id)
    const periods = rules.scene_rule.sites[id].periods
    const tr = read(`public/data/${id}/transects.geojson`)
    const out = reproFromScenes({ ...site.repro, periods, features: tr.features }, fixture(id))
    assert.equal(out.base.length, tr.features.length)
    const cmp = compareWithBoard(out.base, tr.features)
    for (const c of cmp) {
      assert.notEqual(c.diff, null, `가로선 ${c.id} 값 유무가 다름`)
      assert.ok(Math.abs(c.diff) <= 1, `가로선 ${c.id} 차이 ${c.diff} m`)
      assert.ok(c.sceneMax !== null && c.sceneMax <= 1, `가로선 ${c.id} 장면 거리 차이 ${c.sceneMax} m`)
    }
    const rule = rules.site_rules[id]
    const engine = summarize(judgeRows(out.base, rule, periods))
    const board = summarize(judgeRows(normalizeTransects(tr), rule, periods))
    for (const k of ['total', 'judgeable', 'held', 'excluded', 'advance', 'retreat']) assert.equal(engine[k], board[k], k)
    if (id === 'banam') assert.deepEqual([engine.total, engine.judgeable, engine.held, engine.excluded], [36, 7, 14, 15])
  })
}

test('재현 기준 도구: 짝수 반올림, 오츠 칸 가운데 값, 30 m 이어짐 조건', () => {
  assert.equal(roundHalfEven(2324.5), 2324)
  assert.equal(roundHalfEven(2325.5), 2326)
  assert.equal(roundHalfEven(2.4), 2)
  const v = [...Array(100).fill(-0.5), ...Array(100).fill(0.5)]
  const t = otsuCenter(v)
  assert.ok(t > -0.5 && t < 0.5)
  assert.equal(Math.round(((t + 1) * 128 - 0.5) * 1e9) / 1e9 % 1, 0)
  // 바다 쪽 10칸(값 1) 뒤 땅(값 -1)
  const w = 60, h = 3
  const a = new Float64Array(w * h).map((_, i) => ((i % w) < 10 ? 1 : -1))
  const d = shoreDist(a, w, h, 0, [0, 1.5], [1, 0], 59, REPRO_SET)
  assert.ok(Math.abs(d - 100) <= 10)
})

test('재현 기준 결과: 사업지 형식, 구조물 의심 15개, 조건 한 줄과 CSV 머리말', () => {
  const site = sites.find((s) => s.id === 'banam')
  const periods = rules.scene_rule.sites.banam.periods
  const tr = read('public/data/banam/transects.geojson')
  const out = reproFromScenes({ ...site.repro, periods, features: tr.features }, fixture('banam'))
  const run = reproToSite({ ...out, seconds: 1 }, { id: 'run1', name: '고성 반암 재현 기준', base: site, boardRule: rules.site_rules.banam })
  assert.equal(run.site.run, true)
  assert.deepEqual([run.data.summary.total, run.data.summary.judgeable, run.data.summary.held, run.data.summary.excluded], [36, 7, 14, 15])
  assert.deepEqual(run.rule.structureExcluded, rules.site_rules.banam.structureExcluded)
  const none = reproToSite({ ...out, seconds: 1 }, { id: 'run2', name: 'x', base: site, boardRule: rules.site_rules.banam, structureIds: [] })
  assert.equal(none.data.summary.excluded, 0)
  const line = Object.fromEntries(runLine(run))
  assert.equal(line['장면'], '2017. 4. 13., 2017. 5. 3., 2025. 4. 26., 2025. 5. 30.')
  assert.equal(line['가로선 간격'], '30 m')
  assert.equal(line['보류 기준'], '22.9 m')
  const head = conditionsCsvHead(runConditions(run))
  assert.ok(head.every((l) => l.startsWith('# ')))
  const csv = surveyCsv({ site: run.site, rows: run.data.rows, baseScene: run.data.scenes[0], head })
  const lines = csv.replace('\uFEFF', '').split('\r\n').filter(Boolean)
  assert.equal(lines.length, head.length + 1 + 36)
  assert.ok(lines.some((l) => l.startsWith('# 장면,') && l.includes('2025. 5. 30.')))
  assert.ok(lines.some((l) => l.startsWith('# 보류 기준,')))
  assert.ok(lines.some((l) => l.startsWith('# 구조물 의심 가로선,') && l.includes('15개')))
})

test('재현 기준 반암: 가로선별 이동 거리 차이 0.0 m(소수 첫째 자리), 판정 7, 14, 15', () => {
  const site = sites.find((s) => s.id === 'banam')
  const periods = rules.scene_rule.sites.banam.periods
  const tr = read('public/data/banam/transects.geojson')
  const out = reproFromScenes({ ...site.repro, periods, features: tr.features }, fixture('banam'))
  const cmp = compareWithBoard(out.base, tr.features)
  const max = Math.max(...cmp.map((c) => Math.abs(c.diff)))
  assert.equal(max.toFixed(1), '0.0')
  const s = summarize(judgeRows(out.base, rules.site_rules.banam, periods))
  assert.deepEqual([s.total, s.judgeable, s.held, s.excluded], [36, 7, 14, 15])
})

test('현황판 대조 줄: 재현 기준 반암 엔진 값과 현황판 값, 가로선 36개 차이 최대 0.0 m', async () => {
  const { boardDiff, boardDiffLine } = await import('../src/lib/runs.js')
  const site = sites.find((s) => s.id === 'banam')
  const periods = rules.scene_rule.sites.banam.periods
  const tr = read('public/data/banam/transects.geojson')
  const out = reproFromScenes({ ...site.repro, periods, features: tr.features }, fixture('banam'))
  const board = normalizeTransects(tr)
  const d = boardDiff(out.base, board)
  assert.deepEqual([d.n, d.max, d.differ], [36, 0, 0])
  assert.equal(boardDiffLine(d), '현황판 값과 가로선 36개 차이 최대 0.0 m')
  const moved = board.map((r) => (r.id === 26 ? { ...r, change: r.change + 1.24 } : r))
  assert.equal(boardDiffLine(boardDiff(out.base, moved)), '현황판 값과 가로선 36개 차이 최대 1.2 m')
  assert.equal(boardDiff([], board), null)
})
