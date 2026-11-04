import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 정적 배포(GitHub Pages) 주소가 /coast-scorecard/ 이므로 개발 서버와 미리보기도 같은 기본 주소를 쓴다.
// 분석 결과는 scripts/copy_data.mjs 로 public/data/ 에 복사해 함께 배포한다
export default defineConfig({
  base: '/coast-scorecard/',
  plugins: [react()],
  server: { port: 5295, strictPort: true, host: '127.0.0.1' },
  preview: { port: 5292, strictPort: true, host: '127.0.0.1' }
})
