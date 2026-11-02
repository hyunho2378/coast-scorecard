// 근거와 출처. 데이터 출처 표기, 이용 조건, 해상도 한계, 보정 상태, 해안선 정의, 촬영 간격
import { Card, PageHeader, DefList, Chip } from '../ui/index.jsx'
import { fmtDate } from '../lib/ledger.js'

export default function SourcesScreen({ sites, siteData, rules }) {
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready')
  const years = [...new Set(ready.flatMap((s) => siteData[s.id].period.years))].sort()
  const sats = [...new Set(ready.flatMap((s) => siteData[s.id].scenes.map((sc) => sc.id.slice(0, 3))))].sort()

  return (
    <>
      <PageHeader title="근거와 출처" desc="화면의 모든 판정 값이 어디에서 왔고, 어디까지 믿을 수 있는지 적은 자료입니다." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="위성 자료 출처 표기">
          <p className="rounded-sm bg-mute p-4 type-body-strong text-text-pri">
            Contains modified Copernicus Sentinel data {years.length ? years.join(', ') : '연도 확인 중'}
          </p>
          <p className="mt-2 type-meta text-text-meta">사용한 연도는 연결한 사업지 장면 날짜에서 자동으로 모읍니다. 사용 위성: {sats.join(', ') || '확인 중'}</p>
          <div className="mt-4">
            <DefList items={[
              ['이용 조건', 'Copernicus Sentinel 자료는 누구나 무료로 쓰고 가공하고 배포할 수 있으며, 가공한 결과물에는 위 출처 문구를 붙입니다(유럽연합 위임규정 1159/2013).'],
              ['처리 단계', 'Sentinel-2 L2A 지표면 반사도에서 정규수분지수(NDWI) 경계로 물가선을 뽑았습니다.'],
              ['바탕 지도', '지도 타일은 OpenFreeMap, 지도 자료 저작권은 OpenStreetMap 기여자에게 있습니다.']
            ]} />
          </div>
        </Card>

        <Card title="해상도와 한계">
          <DefList items={[
            ['해상도', 'Sentinel-2 가시광과 근적외 밴드 한 칸이 10 m입니다. 이보다 작은 이동은 한 장면 안에서 구분하기 어렵습니다.'],
            ['판정 보류 기준', '사업지별로 같은 계절 장면쌍 사이 위치 차이를 재어 정한 값을 가로선마다 씁니다. 변화가 이 값보다 작으면 판정 보류입니다.'],
            ['조위와 파랑', '한국과 토고 사업지 값은 조위와 파랑을 보정하지 않았습니다. Sand Motor 값만 관측 수위와 측량 경사로 보정했습니다.'],
            ['계통 오차', '조위와 파도 처오름으로 생기는 치우침은 두 장면에 함께 들어가서 판정 보류 기준에 잡히지 않습니다.']
          ]} />
        </Card>

        <Card title="해안선 정의 차이">
          <DefList items={[
            ['위성 해안선', '촬영 순간의 물가선입니다. 그 시각의 조위와 파도에 따라 수십 m까지 움직입니다.'],
            ['측량 해안선', '평균고조위 같은 기준 수위에서 정한 측량 기준선입니다. 효과평가 대장은 이 기준을 씁니다.'],
            ['화면의 뜻', '조위 미보정 값은 두 순간 물가선의 차이이며 측량 기준선의 이동과 같지 않습니다.']
          ]} />
        </Card>

        <Card title="Sentinel-2 촬영 간격">
          <ol className="flex flex-col gap-2">
            <li className="rounded-sm bg-mute px-4 py-3"><p className="type-strong text-text-pri">2017년 3월 이전</p><p className="type-body-sm text-text-sec">위성 1기(Sentinel-2A) 운용, 같은 지점 촬영 간격 10일</p></li>
            <li className="rounded-sm bg-mute px-4 py-3"><p className="type-strong text-text-pri">2017년 3월 이후</p><p className="type-body-sm text-text-sec">위성 2기(Sentinel-2A와 2B) 운용, 촬영 간격 5일</p></li>
          </ol>
          <p className="mt-2 type-meta text-text-meta">구름이 낀 날은 촬영해도 해안선을 쓸 수 없어 실제로 쓰는 장면 간격은 이보다 깁니다.</p>
        </Card>

        <Card title="사업지별 분석 파일" className="xl:col-span-2">
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {sites.map((s) => {
              const d = siteData[s.id]
              return (
                <li key={s.id} className="rounded-sm bg-mute px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2"><p className="type-strong text-text-pri">{s.name}</p>{d?.status === 'ready' && <Chip>{d.tide}</Chip>}</div>
                  {d?.status === 'ready' ? (
                    <p className="type-meta text-text-meta">장면 {d.scenes.map((sc) => fmtDate(sc.date)).join(', ')}. 가로선 {d.rows.length}개. 구름으로 끊긴 장면 {d.scenes.filter((sc) => sc.segments > 1).length}장</p>
                  ) : <p className="type-meta text-text-meta">{d?.status === 'error' ? '읽기 오류' : d?.status === 'empty' ? '분석 자료 없음' : '불러오는 중'}</p>}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 type-meta text-text-meta">민감도와 해석 규칙 파일: {rules?.status === 'ok' ? '연결됨' : rules?.status === 'error' ? `읽기 오류(${rules.message})` : rules?.status === 'loading' ? '확인 중' : '아직 없음, 들어오면 판정 카드에 반영'}</p>
        </Card>
      </div>
    </>
  )
}
