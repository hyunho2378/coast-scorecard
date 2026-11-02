// 화면 그래픽 색. 값은 미리 디자인 토큰(miri/tokens.js, kitTokens.js)에서만 가져온다
import { colors } from '../miri/tokens.js'
import { ios, m3 } from '../miri/kitTokens.js'

export const PAL = {
  ocean: m3.onPrimaryContainer,
  land: ios.gray4,
  graticule: m3.secondary,
  pin: colors.danger.DEFAULT,
  base: colors.warning.DEFAULT,
  current: colors.primary.DEFAULT,
  advance: colors.success.DEFAULT,
  retreat: colors.danger.DEFAULT,
  hold: colors.text.sec,
  halo: colors.page,
  sats: [ios.orange, ios.green, ios.blue, ios.purple, ios.red]
}
