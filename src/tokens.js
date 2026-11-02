// 디자인 토큰 단일 출처. tailwind.config.js, 지도, 지구본, 캔버스 그래픽이 모두 이 파일만 읽는다.
// 값의 뜻과 대비 계산은 docs/DESIGN.md 에 있다. 이 파일 밖에서 색 값과 픽셀 값을 직접 쓰지 않는다.
// 간격, 모션, 화면 폭 단계는 미리(커밋 800f6aa) tokens.js 값을 그대로 따른다. 색은 바다 밤색 바탕의 독자 팔레트다.

export const colors = {
  page: '#08111F',      // 앱 바탕(가장 깊은 바다색)
  rail: '#050B16',      // 왼쪽 메뉴 바탕
  canvas: '#0F1B2E',    // 카드 면
  mute: '#182841',      // 카드 안 칸, 눌림 전 면
  subtle: '#0C1626',    // 지도와 영상 무대 바탕

  text: {
    pri: '#F2F6FC',     // 본문과 제목
    sec: '#C5D1E2',     // 보조 문장
    meta: '#A9B8CD',    // 설명과 단위
    ter: '#97A8C0',     // 가장 약한 글자(모든 면에서 4.5:1 이상)
    inverse: '#04101C'  // 밝은 칩 위 글자
  },

  primary: {
    DEFAULT: '#3FD8C6', // 물가선 청록. 주요 행동, 선택 상태, 초점 고리
    hover: '#72E6D8',
    soft: '#123C46',    // 선택된 메뉴 면
    line: '#1D5A64',
    text: '#5FE3D3'
  },

  line: { sub: '#182841', def: '#22344F', strong: '#344A6E' },

  // 판정 색. 막대와 선, 칩에 쓴다. 칩 글자는 text.inverse
  advance: { DEFAULT: '#52DE94', text: '#7CEAB0' },   // 바다 쪽 전진
  retreat: { DEFAULT: '#FF7F78', text: '#FF9F99' },   // 육지 쪽 후퇴
  hold: { DEFAULT: '#AEB8FF', text: '#C2CAFF' },      // 판정 보류
  sand: { DEFAULT: '#FFB84D', text: '#FFC978' },      // 기준 장면 해안선, 샘플 표시

  danger: { DEFAULT: '#FF7F78', strong: '#FF9F99', soft: '#3A1B24', text: '#FF9F99' },
  warning: { DEFAULT: '#FFB84D', soft: '#3A2B12', text: '#FFC978' },
  success: { DEFAULT: '#52DE94', soft: '#123627', text: '#7CEAB0' }
}

// 3D 지구본 전용 색
export const globe = {
  ocean: '#0B2A4A',
  land: '#2E5A78',
  graticule: '#164066',
  sats: ['#FFB84D', '#52DE94', '#3FD8C6', '#C79BFF', '#FF7F78']
}

export const typography = {
  display: { size: '28px', weight: 800, leading: '36px', tracking: '-0.02em' },
  h1: { size: '24px', weight: 700, leading: '32px', tracking: '-0.02em' },
  h2: { size: '20px', weight: 700, leading: '28px', tracking: '-0.015em' },
  h3: { size: '17px', weight: 700, leading: '24px', tracking: '-0.01em' },
  kpi: { size: '28px', weight: 800, leading: '34px', tracking: '-0.02em' },
  body: { size: '15px', weight: 400, leading: '24px', tracking: '-0.005em' },
  bodySm: { size: '14px', weight: 400, leading: '21px', tracking: '0' },
  strong: { size: '14px', weight: 600, leading: '21px', tracking: '0' },
  caption: { size: '12px', weight: 600, leading: '18px', tracking: '0.01em' },
  meta: { size: '13px', weight: 400, leading: '19px', tracking: '0.005em' }
}

// 4px 기준 간격(미리와 같음)
export const spacing = {
  0.5: '2px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px',
  8: '32px', 10: '40px', 12: '48px', 14: '56px', 16: '64px', 20: '80px', 24: '96px',
  rail: '248px', topbar: '64px'
}

// 반경 한 척도: 8의 배수만 쓴다
export const radius = { sm: '8px', md: '16px', lg: '24px', full: '9999px' }

// 테두리 대신 깊이를 쓴다. 어두운 바탕이라 그림자는 진하게, 단계는 셋
export const shadow = {
  none: 'none',
  sm: '0 2px 8px rgba(0,0,0,0.35)',
  md: '0 8px 24px rgba(0,0,0,0.45)',
  lg: '0 16px 48px rgba(0,0,0,0.55)'
}

export const screens = {
  xs: '320px', sm: '390px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px', '3xl': '1920px', '4xl': '2560px', '5xl': '3840px'
}

export const layout = { pageMax: '1600px', textMax: '720px' }

export const motion = {
  duration: { press: '120ms', fast: '160ms', pop: '180ms', dur: '280ms', sheet: '360ms' },
  easing: {
    out: 'cubic-bezier(0.23,1,0.32,1)',
    inOut: 'cubic-bezier(0.77,0,0.175,1)',
    drawer: 'cubic-bezier(0.32,0.72,0,1)'
  }
}

export const zIndex = { base: '0', raised: '10', nav: '40', drawer: '60', toast: '80' }
