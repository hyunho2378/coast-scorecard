// 자료와 출처. 위성 자료 출처 표기, 판정 규칙, 연도별 보류 기준, 같은 해 장면쌍 위치 차이, 해안선 높이 환산, 분석 파일
import { Box, KV, PageHead, TableWrap } from '../ui/index.jsx'
import { fmtDate } from '../lib/ledger.js'
import { yearThresholdRows } from '../lib/loader-core.js'
import { BASES, thresholdOf } from '../lib/judge.js'

// 해안선 높이 환산 적용 구분. 동해안 환산량은 poc3 4-3(경사 0.17, 2025년 장면), 토고는 같은 절의 2024년에서 2025년 장면쌍 값
const TIDE = {
  banam: ['환산 없음', '수평 0.25 m에서 0.34 m'],
  jinjin: ['환산 없음', '반암과 같은 장면'],
  hwajinpo: ['환산 없음', '반암과 같은 장면'],
  sandmotor: ['환산 적용', '평균고조위 높이'],
  aneho: ['환산 적용 대상', '장면쌍 환산량 4.74 m']
}

// 같은 해 같은 계절 장면 두 장의 가로선 위치 차이. 고성 3곳, 구조물 의심 가로선 제외 135쌍(poc8 보고 표 2)
export const SAMEPAIR_LINE = '같은 해 장면쌍 위치 차이(구조물 의심 제외 135쌍): 표준편차 4.03\u00a0m, 95백분위 7.83\u00a0m, 최대 10.6\u00a0m'

export default function SourcesScreen({ sites, siteData, rules, basis = 'sd1' }) {
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready')
  const years = [...new Set(ready.flatMap((s) => siteData[s.id].period.years))].sort()
  const r = rules?.data
  const name = (id) => sites.find((s) => s.id === id)?.name || id
  const basisLabel = (BASES.find(([k]) => k === basis) || BASES[0])[1]
  // 변화 확인 개수는 앱이 구조물 제외와 장면 규칙까지 적용해 센 값만 쓴다. 규칙 파일 judgeableCount(아네호 17)는 화면에 쓰지 않는다
  const judgeable = (id) => siteData[id]?.status === 'ready' ? siteData[id].summary.judgeable : '읽는 중'
  const errText = (x) => x.surveyAvailable && x.surveyChangeRmseM ? `측량 대조 ${x.surveyChangeRmseM}\u00a0m` : typeof x.priorChangeErrorM === 'number' ? `동해안 ${x.priorChangeErrorM}\u00a0m` : '없음'
  // 장면쌍 90퍼센타일: 연도별 큰 값(구조물 의심 제외). 연도별 값이 없는 해외 사이트는 사이트 값
  const yearRows = yearThresholdRows(r)
  const p90 = (id, x) => {
    const y = yearRows.find((q) => q.id === id && q.part === 'excl') || yearRows.find((q) => q.id === id)
    return y ? y.maxYear : x.samepairP90M
  }
  const def = r?.shoreline_definition
  const scene = r?.scene_rule
  const m = (v) => (typeof v === 'number' ? `${v.toFixed(1)}\u00a0m` : '없음')
  return (
    <>
      <PageHead title="자료와 출처" meta={<><span>사업지 {sites.length}곳</span><span>보류 기준 {basisLabel}</span></>} />
      <div className="cs-two">
        <div className="cs-col">
          <Box title="보류 기준" sub={`${basisLabel} 기준`} flush>
            <TableWrap label="보류 기준 표">
              <table className="cs-table">
                <thead><tr><th>사업지</th><th className="is-num">보류 기준</th><th className="is-num is-wrap"><span className="rb-phrase">장면쌍 90퍼센타일</span> <span className="rb-phrase">연도별 큰 값</span></th><th className="is-num is-wrap">변화량 오차</th><th className="is-num">변화 확인</th></tr></thead>
                <tbody>
                  {sites.map((s) => {
                    const x = r?.site_rules?.[s.id]
                    return x ? (
                      <tr key={s.id}><td className="is-wrap">{s.name}</td><td className="is-num">{thresholdOf(x, basis)}{'\u00a0'}m</td><td className="is-num">{p90(s.id, x)}{'\u00a0'}m</td><td className="is-num">{errText(x)}</td><td className="is-num">{judgeable(s.id)} / {x.nTransects}</td></tr>
                    ) : null
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Box>

          {yearRows.length > 0 && (
            <Box title="연도별 큰 값" sub="같은 계절 장면쌍 90퍼센타일" flush>
              <TableWrap label="연도별 장면쌍 90퍼센타일 표">
                <table className="cs-table">
                  <thead><tr><th>사업지</th><th className="is-num">2017년</th><th className="is-num">2025년</th><th className="is-num is-wrap">두 해 합친 값</th><th className="is-num is-wrap">연도별 큰 값</th><th className="is-num is-wrap">보류 기준</th><th className="is-num">변화 확인</th></tr></thead>
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

          <Box title="같은 계절 장면 비교" sub="고성 화진포와 반암, 가진">
            <p className="cs-samepair">{SAMEPAIR_LINE}</p>
          </Box>

          <Box title="해안선 높이 환산" sub="사업지별 적용" flush>
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
                def && ['해안선 높이', '평균해수면(해양수산부 연안침식 실태조사 과업지시서)'],
                def && ['환산식', '위성 위치 - (0 - 촬영 시각 조위) / 해빈 경사'],
                def && ['해빈 경사', '0.17(허주영 외 2026, 강원 실태조사 현장 대표값)'],
                scene && ['장면 규칙', '같은 해 같은 계절 장면 2장 이상 중앙값']
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
              ['이용 조건', '유럽연합 위임규정 1159/2013, 무료 이용과 가공'],
              ['장면 검색', 'Earth Search STAC(Element 84), sentinel-2-l2a'],
              ['처리 단계', 'L2A 지표면 반사도, NDWI(B03과 B08) 3집단 오츠 물가선'],
              ['바탕 지도', 'OpenFreeMap 타일, 지도 자료 OpenStreetMap 기여자']
            ]} />
          </Box>
          <Box title="판정 규칙">
            <KV items={[
              r?.hold_rule && ['보류 기준', '22.9 m(기본, 선행 연구 위치 오차 16.21 m를 두 시점 변화 오차로 환산), 44.9 m(엄격)'],
              r?.structure_rule && ['구조물 의심', '구조물 30 m 이내 물가선'],
              ['지도 프로그램', 'geotiff.js(MIT), MapLibre GL(BSD)'],
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
