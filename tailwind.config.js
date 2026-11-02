import { colors, spacing, radius, shadow, screens, zIndex, layout, motion, typography } from './src/tokens.js'

// 모든 화면 클래스는 src/tokens.js 한 파일에서 나온다. 글자 단계 .type-* 도 여기서 만든다
const typeName = { bodySm: 'body-sm' }

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens,
    extend: {
      colors,
      spacing,
      borderRadius: radius,
      boxShadow: shadow,
      zIndex,
      maxWidth: { page: layout.pageMax, text: layout.textMax },
      transitionDuration: motion.duration,
      transitionTimingFunction: { out: motion.easing.out, 'in-out': motion.easing.inOut, drawer: motion.easing.drawer }
    }
  },
  plugins: [
    function ({ addComponents }) {
      const out = {}
      for (const [k, t] of Object.entries(typography)) {
        out[`.type-${typeName[k] || k}`] = { fontSize: t.size, fontWeight: String(t.weight), lineHeight: t.leading, letterSpacing: t.tracking }
      }
      out['.type-kpi'].fontVariantNumeric = 'tabular-nums'
      addComponents(out)
    }
  ]
}
