// 지도와 지구본 그래픽 색. 값은 src/tokens.js 에서만 가져온다
import { colors, globe } from '../tokens.js'

export const PAL = {
  ocean: globe.ocean,
  land: globe.land,
  graticule: globe.graticule,
  pin: colors.sand.DEFAULT,
  base: colors.sand.DEFAULT,
  current: colors.primary.DEFAULT,
  advance: colors.advance.DEFAULT,
  retreat: colors.retreat.DEFAULT,
  hold: colors.hold.DEFAULT,
  halo: colors.page,
  sats: globe.sats
}
