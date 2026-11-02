# 연안정비사업 성적표 시연본

2026 스페이스 해커톤 부문 2 시연용 최소 동작본. 화면 3개(지구본, 해안선 지도, 전후 영상 비교)

## 실행

```
npm install
NAPI_RS_FORCE_WASI=1 npm run dev
```

주소: http://127.0.0.1:5288/ (장면 바로 열기: `?scene=map&site=hwajinpo`, `?scene=compare&site=hwajinpo`)
이 컴퓨터에서 rolldown 네이티브 바인딩이 없으면 `npm i @rolldown/binding-wasm32-wasi --no-save --ignore-scripts`를 먼저 실행

## 자료 연결

- 사업지와 파일 후보: `public/config/sites.json`. 후보를 앞에서부터 읽고 처음 열리는 파일을 씀
- `/ext/poc2/` 주소는 개발 서버가 erosion_poc2 폴더(환경 변수 `COAST_POC2_DIR`로 변경 가능)에 연결함. 폴더에 있는 파일만 요청하도록 `/ext/poc2/__list` 목록을 먼저 확인함
- erosion_poc2 파일 형식: `<사업지 id>/shorelines.geojson`(LineString, properties.scene과 properties.date), `<사업지 id>/transects.geojson`(LineString, properties.id와 장면별 거리 properties.dist_m 또는 이동 거리 properties.change_m), `<사업지 id>/before.png`, `after.png`
- 판정 보류 기준값: `public/config/judgement.json`의 holdThresholdM
- 화진포 자료 변환: `python3 scripts/prep_hwajinpo.py <erosion_poc 폴더>`
- 위성 궤도 요소: `public/data/omm_sample.json`(CelesTrak GP 자료를 2026. 11. 3. 한 번 받은 정적 파일)
- 촬영 일정: `public/data/acquisition_sample.json`(샘플 데이터)

## 미리에서 가져온 부품

미리(github.com/hyunho2378/miri, 커밋 800f6aa, MIT, LICENSE.miri)의 `git archive HEAD client tools` 사본에서 가져옴

- `src/miri/kitTokens.js`, `tokens.js`, `index.css`(문서함과 인계 인쇄 서식 제외), `mobile/tokens.css`, `tailwind.config.js`
- `src/miri/ui/IconButton.jsx`, `Disclosure.jsx`, `motion/useReducedMotion.js`, `hooks/useMediaQuery.js`
- `src/miri/map/TimeAxis.jsx`(시간 단위 축을 촬영 장면 단위 축으로 바꿈), `mapTheme.js`(바탕 지도 주소만)
