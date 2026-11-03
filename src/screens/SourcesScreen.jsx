// 근거와 출처. 위성 자료 출처 표기, 판정 규칙, 연도별 보류 기준, 거짓 판정 비율, 해안선 높이 환산, 분석 파일
import { Box, KV, PageHead, TableWrap } from '../ui/index.jsx'
import { fmtDate } from '../lib/ledger.js'
import { falsePositiveRows, yearThresholdRows } from '../lib/loader-core.js'
import { BASES, thresholdOf } from '../lib/judge.js'

// 해안선 높이 환산 적용 구분. 동해안 환산량은 poc3 4-3(경사 0.17, 2025년 장면), 토고는 같은 절의 2024년에서 2025년 장면쌍 값
const TIDE = {
  banam: ['환산 없음', '동해안 2025년 장면의 환산량이 수평 0.25\u00a0m에서 0.34\u00a0m 수준이라 위성 물가선을 그대로 씁니다.'],
  jinjin: ['환산 없음', '반암과 같은 장면이며 환산량은 같은 수준입니다.'],
  hwajinpo: ['환산 없음', '반암과 같은 장면이며 환산량은 같은 수준입니다.'],
  sandmotor: ['환산 적용', '관측 수위와 측량 해빈 경사로 위성 물가선을 평균고조위 높이에 맞춘 뒤 변화량과 장면쌍 차이를 냅니다.'],
  aneho: ['환산 적용 대상', '조차 영향이 커서 2024년에서 2025년 장면쌍 환산량이 4.74\u00a0m입니다. 2021년에서 2022년 장면은 해수면 값이 없어 현재 판정 값은 환산 전 위치입니다.']
}

export default function SourcesScreen({ sites, siteData, rules, basis = 'sd1' }) {
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready')
  const years = [...new Set(ready.flatMap((s) => siteData[s.id].period.years))].sort()
  const r = rules?.data
  const name = (id) => sites.find((s) => s.id === id)?.name || id
  const basisLabel = (BASES.find(([k]) => k === basis) || BASES[0])[1]
  // 판정 가능 개수는 앱이 구조물 제외와 장면 규칙까지 적용해 센 값. 읽기 전이면 규칙 파일 값
  const judgeable = (id, x) => siteData[id]?.status === 'ready' ? siteData[id].summary.judgeable : x.judgeableCount
  const errText = (x) => x.surveyAvailable && x.surveyChangeRmseM ? `측량 대조 ${x.surveyChangeRmseM}\u00a0m` : typeof x.priorChangeErrorM === 'number' ? `동해안 ${x.priorChangeErrorM}\u00a0m` : '없음'
  // 장면쌍 90퍼센타일: 연도별 큰 값(구조물 의심 제외). 연도별 값이 없는 해외 사이트는 사이트 값
  const yearRows = yearThresholdRows(r)
  const p90 = (id, x) => {
    const y = yearRows.find((q) => q.id === id && q.part === 'excl') || yearRows.find((q) => q.id === id)
    return y ? y.maxYear : x.samepairP90M
  }
  const fp = falsePositiveRows(r)
  const def = r?.shoreline_definition
  const scene = r?.scene_rule
  const m = (v) => (typeof v === 'number' ? `${v}\u00a0m` : '없음')
  return (
    <>
      <PageHead title="근거와 출처" meta={<><span>사업지 {sites.length}곳</span><span>판정 기준 {basisLabel}</span></>} />
      <div className="cs-two">
        <div className="cs-col">
          <Box title="판정 보류 기준" sub={`${basisLabel} 기준`} flush>
            <TableWrap label="판정 보류 기준 표">
              <table className="cs-table">
                <thead><tr><th>사업지</th><th className="is-num">보류 기준</th><th className="is-num is-wrap"><span className="rb-phrase">장면쌍 90퍼센타일</span> <span className="rb-phrase">연도별 큰 값</span></th><th className="is-num is-wrap">변화량 오차</th><th className="is-num">판정 가능</th></tr></thead>
                <tbody>
                  {sites.map((s) => {
                    const x = r?.site_rules?.[s.id]
                    return x ? (
                      <tr key={s.id}><td className="is-wrap">{s.name}</td><td className="is-num">{thresholdOf(x, basis)}{'\u00a0'}m</td><td className="is-num">{p90(s.id, x)}{'\u00a0'}m</td><td className="is-num">{errText(x)}</td><td className="is-num">{judgeable(s.id, x)} / {x.nTransects}</td></tr>
                    ) : null
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Box>

          {yearRows.length > 0 && (
            <Box title="연도별 큰 값" sub="같은 계절 장면쌍 90퍼센타일" flush foot={<>
              <span className="rb-phrase">2017년 장면쌍과 2025년 장면쌍의 90퍼센타일을 따로 구하고</span> <span className="rb-phrase">두 값 가운데 큰 값을 사이트 장면 잡음으로 씁니다.</span>{' '}
              <span className="rb-phrase">판정은 두 시점의 잡음을 모두 받으므로</span> <span className="rb-phrase">한 해라도 잡음이 크면 그 값을 따릅니다.</span>{' '}
              <span className="rb-phrase">반암 전체 가로선의 2025년 값 79.9{'\u00a0'}m는</span> <span className="rb-phrase">구조물 위에서 잡힌 물가선 때문에 커진 값입니다.</span>
            </>}>
              <TableWrap label="연도별 장면쌍 90퍼센타일 표">
                <table className="cs-table">
                  <thead><tr><th>사업지</th><th className="is-num">2017년</th><th className="is-num">2025년</th><th className="is-num is-wrap">두 해 합친 값</th><th className="is-num is-wrap">연도별 큰 값</th><th className="is-num is-wrap">1표준편차 기준</th><th className="is-num">판정 가능</th></tr></thead>
                  <tbody>
                    {yearRows.map((y) => (
                      <tr key={`${y.id}-${y.part}`}>
                        <td className="is-wrap">{name(y.id)}{y.id === 'banam' && <span className="is-sub cs-block">{y.part === 'excl' ? `구조물 의심 ${y.excluded}개 제외` : '전체 가로선'}</span>}</td>
                        <td className="is-num">{m(y.p2017)}</td><td className="is-num">{m(y.p2025)}</td><td className="is-num">{m(y.pooled)}</td>
                        <td className="is-num"><strong>{m(y.maxYear)}</strong></td><td className="is-num">{m(y.sd1?.threshold_m)}</td>
                        <td className="is-num">{y.sd1?.judgeable ?? ''} / {y.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Box>
          )}

          {fp.length > 0 && (
            <Box title="보류 기준과 거짓 판정" sub="고성 반암, 판정 대상 20개" flush foot={<>
              <span className="rb-phrase">거짓 판정은 실제 변화가 없는 가로선이 판정 가능으로 나오는 경우입니다.</span>{' '}
              <span className="rb-phrase">비율은 변화량 오차를 표준편차 22.92{'\u00a0'}m 정규분포로 둔 값이고</span> <span className="rb-phrase">95% 기준은 1.96 x 22.92{'\u00a0'}m입니다.</span>{' '}
              <span className="rb-phrase">판정 대상은 결측과 구조물 의심을 뺀 가로선입니다.</span>
            </>}>
              <TableWrap label="보류 기준과 거짓 판정 표">
                <table className="cs-table">
                  <thead><tr><th>기준</th><th className="is-num">보류 기준</th><th className="is-num is-wrap">거짓 판정 비율</th><th className="is-num is-wrap">기대 거짓 판정</th><th className="is-num is-wrap">반암 판정 가능</th></tr></thead>
                  <tbody>
                    {fp.map((x) => (
                      <tr key={x.basis} className={x.basis === basis ? 'is-current' : undefined}><td>{x.label}{x.basis === basis && <span className="is-sub"> 선택</span>}</td><td className="is-num">{x.thresholdM}{'\u00a0'}m</td><td className="is-num">{(x.rate * 100).toFixed(1)}%</td><td className="is-num">{x.expected.toFixed(1)}개</td><td className="is-num">{x.judgeable}개</td></tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Box>
          )}

          <Box title="해안선 높이 환산" sub="사업지별 적용" flush foot={<span className="rb-phrase">동해안 환산량은 해빈 경사 0.17 기준 수평 거리입니다.</span>}>
            <TableWrap label="해안선 높이 환산 표">
              <table className="cs-table">
                <thead><tr><th>사업지</th><th>환산</th><th>내용</th></tr></thead>
                <tbody>
                  {sites.filter((s) => TIDE[s.id]).map((s) => (
                    <tr key={s.id}><td className="is-wrap">{s.name}</td><td>{TIDE[s.id][0]}</td><td className="is-wrap">{TIDE[s.id][1]}</td></tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Box>

          {(def || scene) && (
            <Box title="해안선 정의와 장면 규칙">
              <KV items={[
                def && ['해안선 높이', '해양수산부 연안침식 실태조사 과업지시서(서해안권역 2025, 남해안권역 2024)가 해빈폭과 해빈면적을 평균해수면 기준으로 산출하도록 정해 환산식을 아래처럼 둡니다. 사업지별 적용은 해안선 높이 환산 표에 있습니다.'],
                def && ['환산식', '평균해수면 위치 = 위성 위치 - (0 - 촬영 시각 조위) / 해빈 경사. 조위는 평균해수면 기준이고 위치는 바다 쪽이 양수입니다.'],
                def && ['해빈 경사', '0.17(허주영 외 2026, 강원 실태조사 현장 대표값). 사업지 실태조사 단면이 있으면 그 경사를 씁니다.'],
                def && ['파랑 보정', '파랑 처오름과 셋업은 보정하지 않습니다.'],
                scene && ['장면 규칙', '같은 해 같은 계절 장면 2장 이상의 중앙값을 씁니다. 두 시점 모두 장면이 2장 이상인 가로선만 판정합니다.'],
                scene && ['규칙 적용 결과', '장면이 1장뿐인 시점이 있는 가로선은 판정 보류로 둡니다. 아네호는 이 규칙으로 판정 가능 가로선이 17개에서 16개가 됩니다.']
              ]} />
            </Box>
          )}
          <Box title="분석 파일" flush>
            <TableWrap label="분석 파일 표">
              <table className="cs-table">
                <thead><tr><th>사업지</th><th>장면 날짜</th><th className="is-num">가로선</th></tr></thead>
                <tbody>
                  {ready.map((s) => {
                    const d = siteData[s.id]
                    return <tr key={s.id}><td>{s.name}</td><td className="is-wrap">{d.scenes.map((sc) => fmtDate(sc.date)).join(', ')}</td><td className="is-num">{d.rows.length}</td></tr>
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Box>
        </div>
        <aside className="cs-col">
          <Box title="위성 자료 출처">
            <KV items={[
              ['출처 표기', `Contains modified Copernicus Sentinel data ${years.join(', ')}`],
              ['이용 조건', '유럽연합 위임규정 1159/2013에 따라 누구나 무료로 쓰고 가공하고 배포하며, 가공한 결과물에 위 출처 문구를 붙입니다.'],
              ['처리 단계', 'Sentinel-2 L2A 지표면 반사도에서 정규수분지수 경계로 물가선을 뽑았습니다.'],
              ['바탕 지도', 'OpenFreeMap 타일, 지도 자료 OpenStreetMap 기여자']
            ]} />
          </Box>
          <Box title="판정 규칙">
            <KV items={[
              r?.hold_rule && ['판정 보류', '보류 기준은 연도별 장면쌍 90퍼센타일 중 큰 값과 지역 사전 오차의 변화량 환산값, 10\u00a0m 가운데 가장 큰 값입니다. 사전 오차 환산값은 1표준편차 22.92\u00a0m가 기본이고 상단 바에서 95% 44.9\u00a0m를 고를 수 있습니다.'],
              r?.structure_rule && ['구조물 의심', 'NDWI 변화와 MNDWI 변화의 차이가 22.9\u00a0m를 넘거나 어느 장면의 물가선이 구조물에서 30\u00a0m 이내인 가로선은 판정과 90퍼센타일 계산에서 뺍니다.'],
              r?.annex10 && ['점수 식', r.annex10.source.replace(' 개정문 hwpx', '')],
              ['해상도', 'Sentinel-2 가시광과 근적외 밴드 한 칸 10\u00a0m'],
              ['촬영 간격', '2017년 3월 이전 10일, 이후 위성 2기 운용으로 5일']
            ]} />
          </Box>
        </aside>
      </div>
    </>
  )
}
