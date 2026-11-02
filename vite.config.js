import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// 다른 담당이 만드는 분석 결과 폴더를 개발 서버 주소 /ext/poc2/ 에 연결한다(읽기 전용).
// 폴더 위치는 환경 변수 COAST_POC2_DIR 로 바꿀 수 있다. 파일이 없으면 404 를 돌려 로더가 다음 후보를 읽는다
const POC2_DIR = process.env.COAST_POC2_DIR
  || '/Users/juhyunho/.aside/u/0/sessions/2026-11-03_jTs26DB0VbkJB83T/artifacts/erosion_poc2'
const TYPES = { '.geojson': 'application/geo+json', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' }

function externalData() {
  return {
    name: 'external-poc2',
    configureServer(server) {
      server.middlewares.use('/ext/poc2', (req, res) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0])
        // 목록 주소: 폴더에 있는 파일 경로 배열. 로더가 없는 파일을 요청해 404 가 콘솔에 찍히지 않게 먼저 확인한다
        if (rel === '/__list') {
          const files = []
          const walk = (dir, base) => {
            if (!fs.existsSync(dir)) return
            for (const n of fs.readdirSync(dir)) {
              const full = path.join(dir, n)
              if (fs.statSync(full).isDirectory()) walk(full, base + n + '/')
              else files.push(base + n)
            }
          }
          walk(POC2_DIR, '/ext/poc2/')
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(files))
          return
        }
        const file = path.resolve(POC2_DIR, '.' + rel)
        if (!file.startsWith(path.resolve(POC2_DIR)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(file).pipe(res)
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), externalData()],
  server: { port: 5288, strictPort: true, host: '127.0.0.1' }
})
