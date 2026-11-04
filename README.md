# 연안정비사업 성적표

연안정비사업 사후관리 담당자 콘솔

- 업무: 현황판, 사업지 분석, 판정 카드, 해안선 지도, 전후 영상, 점검 순서 목록
- 기록: 분석 기록, 운영 기준, 문서 센터
- 외부: 자료와 출처
- 상단 띠 주 행동: 새 사업지 분석

## 새 사업지 분석

- 장면 검색: Earth Search STAC(`sentinel-2-l2a`, 구름 10% 미만, 같은 타일과 같은 상대궤도 묶음 우선, 시점별 최대 3장)
- 장면 읽기: geotiff.js(MIT)로 COG 범위 요청, 분석 범위 2 km x 2 km(B03, B08 10 m 창과 SCL 20 m 창, 창 안 구름 5% 넘는 장면 제외)
- 물가선: NDWI 3집단 오츠 위 경계, marching squares, 300 m 미만 조각 제외
- 가로선: 사업 전 첫 장면 물가선을 따라 100 m 간격, 길이 400 m, 육지 쪽에서 바다 쪽
- 판정: 같은 해 장면 중앙값 차이, 보류 기준 22.9 m(1표준편차) 또는 44.9 m(95%), 같은 해 장면쌍 차이가 기준을 넘으면 보류, 구조물 다각형 30 m 이내 물가선은 구조물 의심
- UTM 변환: `src/engine/utm.js`(Krüger 6차 급수)
- 결과는 화면 메모리와 내려받기 파일(JSON)로만 둠

## 실행

```
npm install
NAPI_RS_FORCE_WASI=1 npm run dev
```

- 주소: http://127.0.0.1:5295/coast-scorecard/ (예: `#/card?site=banam`, `#/map?site=aneho`, `#/storm`)
- 화면 모드: 기본 어두운 화면. 주소에 `?mode=light`, `?mode=high-contrast`, `?mode=theme`를 붙이거나 상단 바 화면 설정에서 고름. 저장소에 남기지 않음
- rolldown 네이티브 바인딩이 없으면 `npm i @rolldown/binding-wasm32-wasi --no-save --ignore-scripts`를 먼저 실행
- 시험: `npm test`(node --test, 판정 규칙, 로더, 대장 문구)
- 다른 포트: `NAPI_RS_FORCE_WASI=1 npm run dev -- --port 5289`
- 반응형 확인: `http://127.0.0.1:5295/coast-scorecard/rwd.html?w=390&h=844&hash=/card?site=banam`(같은 출처 고정 폭 iframe)

## 디자인 기초

공공 깃랩 2차 리빌딩(`07. 청년 공공 AX 서포터즈/2차_리빌딩/app`)의 KRDS 기초를 그대로 가져옴. 색과 글자, 간격, 반경은 KRDS CSS 변수에서만 옴

- `public/krds/resources/css`, `fonts`, `img`, `public/krds/bridge`: KRDS 공식 CSS와 글꼴, 아이콘
- `src/krds/dark.generated.css`, `syntax.generated.css`: KRDS 어두운 화면 변수(공공 깃랩 바탕 규칙)
- `src/krds/layout.tokens.css`, `status.tokens.css`: 공공 깃랩 화면 뼈대 값과 상태 색 계단
- `src/krds/base.css`: 공공 깃랩 `styles.css`
- `src/krds/shell.css`: 공공 깃랩 `components/Layout/shell.css`(상단 바, 왼쪽 세로 바, 둥근 판)
- `tailwind.config.cjs`: 공공 깃랩 설정 그대로(기본 팔레트와 크기 스케일 비움)
- `src/tokens.js`: 의미 연결만. 지도는 `src/lib/palette.js`가 실행 중 KRDS 변수 값을 읽어 씀
- `src/styles.css`: 앱 전용 규칙(표, 상자, 판정 글자, 지도 무대). KRDS 변수만

## 자료 연결

- 사업지와 파일 후보: `public/config/sites.json`(고성 화진포, 고성 반암, 고성 가진, 토고 Agbodrafo, 네덜란드 Sand Motor)
- 분석 결과 22개 파일(약 3.0 MB)을 `public/data/`에 두고 앱 기본 주소 기준 상대 경로(`data/...`)로 읽음. 갱신: `COAST_POC2_DIR=<분석 폴더> npm run data`
- 규칙 파일: `sensitivity_and_rules_v3.json`(6차 분석, 2026. 11. 3.). v2는 분석 폴더에 그대로 둠
- 판정 보류 기준: `site_rules`. 기준 = max(연도별 같은 계절 장면쌍 90퍼센타일 중 큰 값, 지역 사전 오차의 변화량 환산값 또는 공개 측량 대조 오차, 10 m). 한국 세 곳은 1표준편차 22.9 m가 기본이고 상단 바 판정 기준 메뉴에서 95% 44.9 m를 고름. 변화가 기준 이하이거나 그 가로선의 같은 계절 장면쌍 차이가 기준을 넘으면 보류. Sand Motor는 `data/sandmotor/sandmotor_spring_vs_jarkus_rows.json`의 조위 환산 위치로 장면쌍 차이를 만듦
- 구조물 의심 제외: `site_rules.banam.structureExcluded`(가로선 15개). NDWI 변화와 MNDWI 변화의 차이가 22.9 m를 넘거나 물가선이 구조물 30 m 이내이면 판정과 구간 평균에서 뺌. 판정 열은 "구조물 의심, 제외", 지도는 점선
- 현재 값(1표준편차): 고성 반암 기준 초과 7/36(26번에서 32번, 전진 7, 변화 +23.9 m에서 +41.2 m), 구간 평균 +16.0 m(구조물 의심 제외 20개). 95% 기준에서 0개. 고성 가진 0/37, 고성 화진포 0/16(비교 해변). 반암 장면쌍 90퍼센타일은 전체 가로선 2017년 7.0 m, 2025년 79.9 m, 구조물 의심 제외 6.3 m와 5.9 m
- 거짓 판정 비율(정규 가정): 1표준편차 31.7%, 반암 판정 대상 20개에서 기대 6.3개. 95% 5.0%, 기대 1.0개
- 오차 유형별 점수 변동: `sensitivity_unified` 한 표(상하한 적용 전과 후 열). 반암 치우침(두 시점 독립) 합계 9.73점과 7.42점, 가진 14.47점과 8.39점
- 해안선 높이 환산: 한국 세 곳은 환산 없음(동해안 환산량 수평 0.25 m에서 0.34 m). Sand Motor는 평균고조위 환산 적용, 토고는 적용 대상(2024년에서 2025년 장면쌍 환산량 4.74 m)
- 사업비와 다음 적용 후보: `project_facts`. 반암 약 105억 원, 가진 약 119억 원(효과평가 법정 대상 200억 원 이상 아님). 다음 적용 후보 봉포, 월천, 속초해수욕장은 사업지 목록에 표시하고 점수는 계산하지 않음
- 별표 10 점수 식: 같은 파일의 `annex10`
- 위성 궤도 요소: `public/data/omm.json`(CelesTrak GP, 2026. 11. 3. 받음)
- 점검 완료 표시와 메모: 화면 안 상태로만 둠
- 현장 측량 구간 CSV: 판정 카드의 내려받기 단추. 열은 우선순위와 사업지, 가로선, 판정, 방향, 이동 거리(m), 보류 기준(m), 위도, 경도, 판정 내용. 위도와 경도는 기준 장면 해안선과 가로선이 만나는 해안 쪽 기준 점(WGS84 소수 6자리), 만나지 않으면 가로선 중간점. 구조물 의심 가로선, 기준 초과, 판정 보류 순서이고 UTF-8 BOM과 CRLF로 엑셀에서 한글이 깨지지 않음
- 대장 옮김 문구: 첫 줄 아래에 기준 초과 개수와 같은 기준에서 오차만으로 나올 수 있는 기대 수(반암 1표준편차 6.3개, 95% 1.0개, 구조물 의심 제외 판정 대상 20개 기준)

## 배포

- `vite.config.js`의 `base`는 `/coast-scorecard/`. `npm run build` 결과(dist)를 gh-pages 브랜치에 올려 GitHub Pages로 공개
- 개발 서버 5295, 미리보기 5292

## 미리에서 가져온 동작

미리(github.com/hyunho2378/miri, 커밋 800f6aa, MIT, LICENSE.miri)의 `TimeAxis.jsx` 재생 동작을 `src/parts/TimeAxis.jsx`로 옮김. 미리의 색과 토큰은 쓰지 않음
