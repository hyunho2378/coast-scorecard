// 근거와 출처. 위성 자료 출처 표기, 판정 규칙, 분석 파일
import { Box, KV, PageHead } from '../ui/index.jsx'
import { fmtDate } from '../lib/ledger.js'

export default function SourcesScreen({ sites, siteData, rules }) {
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready')
  const years = [...new Set(ready.flatMap((s) => siteData[s.id].period.years))].sort()
  const r = rules?.data
  // 판정 가능 개수는 앱이 장면 규칙까지 적용해 센 값. 읽기 전이면 규칙 파일 장면 규칙 값
  const judgeable = (id, x) => siteData[id]?.status === 'ready' ? siteData[id].summary.judgeable : (r?.scene_rule?.sites?.[id]?.judgeableUnderRule ?? x.judgeableCount)
  const errText = (x) => x.surveyAvailable && x.surveyChangeRmseM ? `측량 대조 ${x.surveyChangeRmseM}\u00a0m` : typeof x.priorChangeErrorM === 'number' ? `동해안 ${x.priorChangeErrorM}\u00a0m` : '없음'
  const def = r?.shoreline_definition
  const scene = r?.scene_rule
  return (
    <>
      <PageHead title="근거와 출처" meta={<span>사업지 {sites.length}곳</span>} />
      <div className="cs-two">
        <div className="cs-col">
          <Box title="판정 보류 기준" flush>
            <div className="cs-table-wrap">
              <table className="cs-table">
                <thead><tr><th>사업지</th><th className="is-num">보류 기준</th><th className="is-num is-wrap"><span className="rb-phrase">같은 계절 장면쌍</span> <span className="rb-phrase">90퍼센타일</span></th><th className="is-num is-wrap">변화량 오차</th><th className="is-num">판정 가능</th></tr></thead>
                <tbody>
                  {sites.map((s) => {
                    const x = r?.site_rules?.[s.id]
                    return x ? (
                      <tr key={s.id}><td className="is-wrap">{s.name}</td><td className="is-num">{x.holdThresholdM}{'\u00a0'}m</td><td className="is-num">{x.samepairP90M}{'\u00a0'}m</td><td className="is-num">{errText(x)}</td><td className="is-num">{judgeable(s.id, x)} / {x.nTransects}</td></tr>
                    ) : null
                  })}
                </tbody>
              </table>
            </div>
          </Box>
          {(def || scene) && (
            <Box title="해안선 정의와 장면 규칙">
              <KV items={[
                def && ['해안선 높이', '위성 순간 물가선을 평균해수면 높이로 환산합니다. 해양수산부 연안침식 실태조사 과업지시서(서해안권역 2025, 남해안권역 2024)가 해빈폭과 해빈면적을 평균해수면 기준으로 산출하도록 정했기 때문입니다.'],
                def && ['환산식', '평균해수면 위치 = 위성 위치 - (0 - 촬영 시각 조위) / 해빈 경사. 조위는 평균해수면 기준이고 위치는 바다 쪽이 양수입니다.'],
                def && ['해빈 경사', '0.17(허주영 외 2026, 강원 실태조사 현장 대표값). 사업지 실태조사 단면이 있으면 그 경사를 씁니다.'],
                def && ['파랑 보정', '파랑 처오름과 셋업은 보정하지 않습니다.'],
                scene && ['장면 규칙', '같은 해 같은 계절 장면 2장 이상의 중앙값을 씁니다. 두 시점 모두 장면이 2장 이상인 가로선만 판정합니다.'],
                scene && ['규칙 적용 결과', `장면이 1장뿐인 시점이 있는 가로선은 판정 보류로 둡니다. 아네호는 이 규칙으로 판정 가능 가로선이 17개에서 16개가 됩니다.`]
              ]} />
            </Box>
          )}
          <Box title="분석 파일" flush>
            <div className="cs-table-wrap">
              <table className="cs-table">
                <thead><tr><th>사업지</th><th>장면 날짜</th><th className="is-num">가로선</th></tr></thead>
                <tbody>
                  {ready.map((s) => {
                    const d = siteData[s.id]
                    return <tr key={s.id}><td>{s.name}</td><td className="is-wrap">{d.scenes.map((sc) => fmtDate(sc.date)).join(', ')}</td><td className="is-num">{d.rows.length}</td></tr>
                  })}
                </tbody>
              </table>
            </div>
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
              r?.hold_rule && ['판정 보류', r.hold_rule.text],
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
