// 근거와 출처. 위성 자료 출처 표기, 판정 규칙, 분석 파일
import { Box, KV, PageHead } from '../ui/index.jsx'
import { fmtDate } from '../lib/ledger.js'

export default function SourcesScreen({ sites, siteData, rules }) {
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready')
  const years = [...new Set(ready.flatMap((s) => siteData[s.id].period.years))].sort()
  const r = rules?.data
  return (
    <>
      <PageHead title="근거와 출처" meta={<span>사업지 {sites.length}곳</span>} />
      <div className="cs-two">
        <div className="cs-col">
          <Box title="판정 보류 기준" flush>
            <div className="cs-table-wrap">
              <table className="cs-table">
                <thead><tr><th>사업지</th><th className="is-num">보류 기준</th><th className="is-num">같은 계절 장면쌍 90퍼센타일</th><th className="is-num">측량 대조 오차</th><th className="is-num">판정 가능</th></tr></thead>
                <tbody>
                  {sites.map((s) => {
                    const x = r?.site_rules?.[s.id]
                    return x ? (
                      <tr key={s.id}><td>{s.name}</td><td className="is-num">{x.holdThresholdM}{'\u00a0'}m</td><td className="is-num">{x.samepairP90M}{'\u00a0'}m</td><td className="is-num">{x.surveyChangeRmseM ? `${x.surveyChangeRmseM}\u00a0m` : ''}</td><td className="is-num">{x.judgeableCount} / {x.nTransects}</td></tr>
                    ) : null
                  })}
                </tbody>
              </table>
            </div>
          </Box>
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
