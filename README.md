# 해안선 성적표 담당자 콘솔(시연본)

2026 스페이스 해커톤 부문 2 시연용. 연안정비사업 사후관리 담당자 콘솔 구조로, 화면 7개(지구본, 사업지 목록, 판정 카드, 해안선 지도와 시간 축, 전후 영상 비교, 폭풍 뒤 점검 목록, 근거와 출처)

## 실행

```
npm install
NAPI_RS_FORCE_WASI=1 npm run dev
```

주소: http://127.0.0.1:5288/ (화면 바로 열기: `#/card?site=banam`, `#/map?site=aneho`, `#/storm`)
이 컴퓨터에서 rolldown 네이티브 바인딩이 없으면 `npm i @rolldown/binding-wasm32-wasi --no-save --ignore-scripts`를 먼저 실행
시험: `npm test`(node --test), 대비 계산: `node scripts/contrast.mjs`
반응형 확인: `http://127.0.0.1:5288/rwd.html?w=390&h=844&hash=/card?site=banam`(같은 출처 고정 폭 iframe)

## 문서

- `docs/DESIGN.md` 색 역할, 글자 단계, 간격, 반경, 그림자, 모션, 대비 계산 결과
- `docs/IA.md` 화면 구조와 이동
- `docs/UI.md` 부품 목록과 상태
- 토큰 단일 출처: `src/tokens.js`

## 자료 연결

- 사업지와 파일 후보: `public/config/sites.json`(사업지 5곳: 고성 화진포, 고성 반암, 고성 가진, 토고 Agbodrafo, 네덜란드 Sand Motor)
- `/ext/poc2/` 주소는 개발 서버가 erosion_poc2 폴더(환경 변수 `COAST_POC2_DIR`로 변경 가능)에 연결함. 빌드 결과(dist)만 열면 사업지 자료가 "분석 자료 없음" 상태로 보임
- 해안선: `<사업지>/shorelines.geojson`(LineString 또는 구름으로 끊긴 MultiLineString, properties.scene, date, tide_corrected)
- 가로선: `<사업지>/transects.geojson`(properties.id, change_m, hold, hold_threshold_m, tide_corrected, dist_m). 판정과 보류 기준은 이 값을 그대로 씀. 앱 고정 기준값 없음
- 민감도와 규칙(선택): `sensitivity_and_rules.json`. 없으면 판정 카드의 등급 변동 폭 칸이 "계산 중"
- 위성 궤도 요소: `public/data/omm_sample.json`(CelesTrak GP 자료를 2026. 11. 3. 한 번 받은 정적 파일)
- 촬영 일정: `public/data/acquisition_sample.json`(샘플 데이터), 기상특보 이력: `public/data/storm_sample.json`(샘플 데이터)
- 점검 완료 표시와 메모: 브라우저 저장소(localStorage)에만 저장

## 미리에서 가져온 부품

미리(github.com/hyunho2378/miri, 커밋 800f6aa, MIT, LICENSE.miri)의 `git archive HEAD client tools` 사본에서 가져옴

- `src/miri/kitTokens.js`, `tokens.js`, `index.css`(문서함과 인계 인쇄 서식 제외), `mobile/tokens.css`, `tailwind.config.js`
- `src/miri/ui/IconButton.jsx`, `Disclosure.jsx`, `motion/useReducedMotion.js`, `hooks/useMediaQuery.js`
- `src/miri/map/TimeAxis.jsx`(시간 단위 축을 촬영 장면 단위 축으로 바꿈), `mapTheme.js`(바탕 지도 주소만)
