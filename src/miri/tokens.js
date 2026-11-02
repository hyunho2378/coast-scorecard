import { ios, m3, kitShadow } from './kitTokens.js'
// tokens.js G-Chat 디자인 토큰 단일 출처
// tailwind.config.js가 이 파일을 import한다. 컴포넌트는 Tailwind 클래스로만 쓴다.
// 이 파일 밖에서 hex와 px를 직접 쓰지 않는다. DESIGN.md와 값이 다르면 여기가 맞다.

// 2026-10-21 키트 색 역할 적용. 색 원본은 kitTokens.js.
// 기존 소비자 이름은 호환 별칭. 실제 값은 kitTokens.js에서만 정의한다.
export const krds = {
 gray: {0:ios.white,5:ios.grouped,10:ios.fill,20:ios.gray4,30:ios.gray3,40:ios.gray2,50:ios.secondaryText,60:ios.secondaryText,70:ios.secondaryText,80:ios.label,90:ios.label,95:ios.label},
 primary: {5:ios.grouped,10:ios.fill,20:ios.blue,30:ios.blue,40:ios.blue,50:m3.primary,60:m3.primary,70:m3.primary,80:m3.primary},
 point: {5:ios.grouped,10:ios.fill,20:ios.red,30:ios.red,40:ios.red,50:m3.error,60:m3.error,70:m3.error}
}
const g = krds.gray
const p = krds.primary
const r = krds.point

export const colors = {
  page: g[0],          // background.white
  canvas: g[5],        // background.gray-subtler
  mute: g[10],         // surface.gray-subtle
  subtle: g[5],        // surface.gray-subtler

  text: {
    pri: g[90],        // text.basic
    sec: g[70],        // text.subtle
    meta: g[60],       // 보조 설명(7.0:1)
    ter: g[50],        // 최소 대비 글자(4.6:1). 비활성 대신 쓰지 않는다
    inverse: g[0]
  },

  primary: {
    DEFAULT: p[50],    // border.primary, 주요 행동
    hover: p[60],
    soft: p[10],       // 선택 면. primary-subtler(5) 는 흰 바탕 위 경계가 안 읽혀 한 단계 올린다
    line: p[20],
    text: p[60]        // text.primary
  },

  line: {
    sub: g[10],        // 카드 안 구분선
    def: g[20],        // border.gray-light, divider.gray-light
    strong: g[30]      // border.gray
  },

  // 위험과 부족. KRDS point 계열
  danger:  { DEFAULT: r[50], strong: r[60], soft: r[5], text: r[60] },
  // 이름만 남긴다. 값은 위험 빨강(warning) 과 무채색(success) 이다
  // DEFAULT 는 막대, 아이콘, 상태 점 같은 비텍스트 그래픽에 쓴다. 흰 면과 회색 면 모두 3:1 이상인 HIG 고대비 값(플랫폼 AI 협업 툴 검토 반영)
  // 주황 #C93400 흰 5.28, #F2F2F7 4.73, #E5E5EA 4.21. 초록 #008932 흰 4.54, #F2F2F7 4.07, #E5E5EA 3.62
  warning: { DEFAULT: ios.orangeAccessible, soft: ios.fill, text: ios.label },
  success: { DEFAULT: ios.greenAccessible, soft: ios.fill, text: ios.label },

  // 문서함 종류 식별색(DAH Docs·Sheet·Form 규칙 준용: 흐린 틴트 금지, 진한 단색). 아이콘, 배지, 서식 카드 머리에만 쓴다
  // 흰 글자 배지(11px 굵게)와 흰 면 위 글자 모두 4.5:1 이상이 되도록 HIG 고대비(Increased contrast, light) 값을 쓴다. 파랑 4.57, 초록 4.54, 보라 5.21
  kind: { doc: ios.blueAccessible, sheet: ios.greenAccessible, form: ios.purpleAccessible },
  chart: {
    1: p[50],
    2: g[70],
    3: g[50],
    4: g[40],
    heat: { 1: p[20], 2: p[30], 3: p[40], 4: p[50] },
    heatDanger: { 1: r[10], 2: r[30], 3: r[50], 4: r[60] }
  }
}

// prefers-contrast: more 에서 교체하는 값. index.css @media 에서 CSS 변수로 덮는다
export const contrastOverrides = {
  'line-sub': colors.line.def,
  'text-meta': colors.text.sec
}

// 타이포. index.css @layer components 의 .type-* 클래스가 이 값을 그대로 쓴다
// 8단계. "죄다 얇아서 위계가 안 보인다"는 피드백으로 웨이트 사다리를 400 / 600 / 700 / 800 넷으로 벌렸다.
// 인접해 놓이는 짝은 최소 200 차이가 난다. 라벨(caption 600) 대 값(kpi 800), 카드 타이틀(h3 700) 대 본문(body 400),
// 델타(caption 600) 대 보조 문구(meta 400) 다. 큰 활자는 크기 하한을 올리고 자간을 좁혀 덩어리감을 줬다.
// 서체는 KRDS 표준 Pretendard GOV. 굵기는 KRDS 대로 400 과 700 두 가지만 쓴다
// 미리 UI_PLAYBOOK 2.2: 800 display kpi / 700 h1 h2 h3 / 600 caption strong 버튼 탭 표 헤더 / 400 본문. 500 금지
export const typography = {
  display: { size: 'clamp(30px, 2vw + 21px, 42px)', weight: 800, tracking: '-0.035em', leading: 1.14 },
  h1:      { size: 'clamp(24px, 1vw + 19px, 32px)', weight: 700, tracking: '-0.025em', leading: 1.2 },
  h2:      { size: 'clamp(18px, 0.5vw + 16px, 22px)', weight: 700, tracking: '-0.02em', leading: 1.25 },
  h3:      { size: 'clamp(17px, 0.3vw + 15.5px, 19px)', weight: 700, tracking: '-0.02em', leading: 1.3 },
  kpi:     { size: 'clamp(28px, 1.2vw + 22px, 40px)', weight: 800, tracking: '-0.03em', leading: 1.05 },
  body:    { size: 'clamp(15px, 0.2vw + 14px, 17px)', weight: 400, tracking: '-0.01em', leading: 1.7 },
  bodySm:  { size: 'clamp(13px, 0.15vw + 12.5px, 14px)', weight: 400, tracking: '-0.005em', leading: 1.55 },
  strong:  { size: 'clamp(13px, 0.15vw + 12.5px, 14px)', weight: 600, tracking: '-0.005em', leading: 1.55 },
  bodyStrong: { size: 'clamp(15px, 0.2vw + 14px, 17px)', weight: 600, tracking: '-0.01em', leading: 1.7 },
  caption: { size: 'clamp(11px, 0.1vw + 10.5px, 12px)', weight: 600, tracking: '0', leading: 1.4 },
  meta:    { size: '12px', weight: 400, tracking: '0.01em', leading: 1.4 },
  // 알림 카운트 전용. 벨 아이콘을 가리지 않으려면 배지가 16px 이어야 하고 그 안에 들어가는 유일한 크기다
  count:   { size: '10px', weight: 700, tracking: '0.01em', leading: 1 }
}

export const spacing = {
  0.5: '2px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px',
  8: '32px', 10: '40px', 12: '48px', 14: '56px', 16: '64px', 20: '80px', 24: '96px',
  // 레이아웃 고정 치수
  nav: '64px',
  'nav-m': '56px',
  topbar: '56px',
  sidebar: '240px',
  rail: '64px',
  'chat-rail': '56px',
  'source-col': '340px',
  'source-col-md': '320px'
}

// DESIGN_DELTA.md 변경 3. 봄내와 동일한 6단 스케일. xs 는 작은 배지와 표 내부용
export const radius = {
  xs: '8px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '28px',
  full: '9999px'
}

// DESIGN_DELTA.md 변경 1·3 무보더 원칙. 깊이는 이 3단으로만.
// 관리자 카드 기본 sm, hover md, 드로어 모달 시트 lg.
// card 는 sm 별칭, float 는 lg 별칭으로 tailwind.config 에서 매핑한다(컴포넌트가 두 이름을 쓴다)
export const shadow = { none: 'none', ...kitShadow }

export const screens = {
  xs: '320px',
  sm: '390px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1440px',
  '3xl': '1920px',
  '4xl': '2560px',
  '5xl': '3840px'
}

export const layout = {
  pageMax: '1400px',
  wideMax: '1600px',
  chatMax: '1140px',
  composerMax: '680px',
  textMax: '720px',
  // 페이지 좌우 패딩. Tailwind 클래스 px-4 md:px-6 lg:px-8 xl:px-10 3xl:px-16
  pagePx: { xs: 16, md: 24, lg: 32, xl: 40, '3xl': 64 }
}

// DESIGN_DELTA.md 변경 4. UI 전환 상한 300ms 미만. 기존 page 320 은 dur 280 으로 내렸다
export const motion = {
  duration: {
    press: '120ms',   // press 피드백
    fast: '160ms',    // 색 배경 hover, 탭 인디케이터
    pop: '180ms',     // 드롭다운 팝 진입 퇴장
    dur: '280ms',     // 진입 페이지 전환
    sheet: '360ms'    // 드로어 시트
  },
  easing: {
    out: 'cubic-bezier(0.23,1,0.32,1)',      // 진입 퇴장 기본
    inOut: 'cubic-bezier(0.77,0,0.175,1)',   // 화면 내 이동
    drawer: 'cubic-bezier(0.32,0.72,0,1)',   // 시트 드로어
    spring: 'cubic-bezier(0.32,1.32,0.5,1)'  // 모멘텀 결과 전용. 일반 UI 금지
  },
  press: 'scale(0.97)',
  skeleton: { duration: '1.4s', from: colors.line.def, to: colors.text.ter }
}

export const zIndex = {
  base: '0',
  raised: '10',
  nav: '40',
  dropdown: '50',
  drawer: '60',
  modal: '70',
  toast: '80'
}

export const icon = {
  sizes: [16, 20, 24, 32, 48],
  stroke: 1.75
}
