// UI.md 규칙: 의미 연결만 둔다. 값은 KRDS 변수가 유일한 출처다.
// 지도(maplibre)와 지구본(three)은 CSS 변수를 직접 못 읽어서 lib/palette.js가 실행 중에 이 이름을 실제 값으로 바꾼다
export const tokens = Object.freeze({
  background: 'var(--krds-color-background-white)',
  text: 'var(--krds-color-text-basic)',
  gap: 'var(--krds-gap-7)',
  padding: 'var(--krds-padding-8)',
  radius: 'var(--krds-radius-medium1)'
})

// 그래픽 역할. 판정 색은 공공 깃랩 상태 색(status.tokens.css)과 같은 계단을 쓴다
export const graphic = Object.freeze({
  ocean: '--krds-color-surface-gray-subtler',
  land: '--krds-color-surface-gray-subtle',
  graticule: '--krds-color-border-gray-light',
  pin: '--cs-line-base',
  base: '--cs-line-base',
  current: '--rb-status-primary',
  advance: '--rb-status-information',
  retreat: '--rb-status-danger',
  hold: '--krds-color-icon-gray',
  halo: '--krds-color-background-white',
  sats: ['--rb-status-primary', '--rb-status-success', '--rb-status-warning']
})
