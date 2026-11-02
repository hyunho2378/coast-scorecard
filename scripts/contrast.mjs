// 토큰 색으로 글자와 바탕 대비를 계산한다. node scripts/contrast.mjs
import { colors as c } from '../src/tokens.js'
const lum = (hex) => { const v = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const bgs = { page: c.page, rail: c.rail, canvas: c.canvas, mute: c.mute, subtle: c.subtle }
const fgs = { 'text.pri': c.text.pri, 'text.sec': c.text.sec, 'text.meta': c.text.meta, 'text.ter': c.text.ter, 'primary.text': c.primary.text, 'advance.text': c.advance.text, 'retreat.text': c.retreat.text, 'hold.text': c.hold.text, 'danger.text': c.danger.text, 'warning.text': c.warning.text }
let fail = 0
for (const [fn, f] of Object.entries(fgs)) {
  const row = Object.entries(bgs).map(([bn, b]) => { const r = ratio(f, b); if (r < 4.5) fail++; return `${bn} ${r.toFixed(2)}` })
  console.log(`${fn} ${f}: ${row.join(', ')}`)
}
const chips = { primary: c.primary.DEFAULT, advance: c.advance.DEFAULT, retreat: c.retreat.DEFAULT, hold: c.hold.DEFAULT, sand: c.sand.DEFAULT, 'primary.hover': c.primary.hover }
for (const [n, b] of Object.entries(chips)) { const r = ratio(c.text.inverse, b); if (r < 4.5) fail++; console.log(`text.inverse on ${n} ${b}: ${r.toFixed(2)}`) }
for (const [n, f, b] of [['primary.text on primary.soft', c.primary.text, c.primary.soft], ['warning.text on warning.soft', c.warning.text, c.warning.soft], ['text.pri on mute', c.text.pri, c.mute], ['text.pri on line.def', c.text.pri, c.line.def], ['text.ter on mute', c.text.ter, c.mute]]) { const r = ratio(f, b); if (r < 4.5) fail++; console.log(`${n}: ${r.toFixed(2)}`) }
for (const [n, f, b] of [['초점 고리 primary on page', c.primary.DEFAULT, c.page], ['초점 고리 primary on canvas', c.primary.DEFAULT, c.canvas], ['막대 hold on mute', c.hold.DEFAULT, c.mute], ['막대 advance on mute', c.advance.DEFAULT, c.mute], ['막대 retreat on mute', c.retreat.DEFAULT, c.mute]]) console.log(`${n}: ${ratio(f, b).toFixed(2)} (그래픽 기준 3:1)`)
console.log(`4.5 미만 조합 ${fail}개`)
