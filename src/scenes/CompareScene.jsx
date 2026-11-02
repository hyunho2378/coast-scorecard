// 전후 위성 영상 비교. 손잡이를 끌거나 방향키로 경계를 옮긴다
import { useId, useState } from 'react'
import { Card, PageHeader, TestBadge, StateBlock, SiteState, DefList } from '../ui/index.jsx'

export default function CompareScene({ site, data }) {
  const id = useId()
  const [pos, setPos] = useState(50)
  const [broken, setBroken] = useState(false)
  const header = <PageHeader title="전후 영상 비교" desc={site.name} badges={<TestBadge />} />
  if (!data || data.status === 'loading' || data.status === 'error') return <>{header}<SiteState data={data} /></>
  const has = data.before && data.after && !broken
  const years = data.period?.years || []
  const y0 = years[0], y1 = years[years.length - 1]

  return (
    <>
      {header}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-md bg-subtle p-4">
          {has ? (
            <div className="relative aspect-square w-full max-w-[720px] select-none overflow-hidden rounded-sm">
              <img src={data.before} onError={() => setBroken(true)} alt={`${site.name} 이전 시기 ${y0}년 위성 영상`} className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]" draggable="false" />
              <img src={data.after} onError={() => setBroken(true)} alt={`${site.name} 이후 시기 ${y1}년 위성 영상`} className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} draggable="false" />
              <span className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-text-pri" style={{ left: `${pos}%` }} aria-hidden="true" />
              <span className="pointer-events-none absolute top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-pri shadow-md" style={{ left: `${pos}%` }} aria-hidden="true" />
              <span className="absolute left-3 top-3 rounded-sm bg-sand px-3 py-1 type-caption text-text-inverse">이전 {y0}년</span>
              <span className="absolute right-3 top-3 rounded-sm bg-primary px-3 py-1 type-caption text-text-inverse">이후 {y1}년</span>
              <label htmlFor={id} className="sr-only">비교 경계 위치</label>
              <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
                className="peer absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
              <span className="pointer-events-none absolute inset-0 rounded-sm peer-focus-visible:shadow-[inset_0_0_0_3px] peer-focus-visible:shadow-primary" aria-hidden="true" />
            </div>
          ) : (
            <StateBlock kind={broken ? 'error' : 'empty'} title={broken ? '영상을 읽지 못했습니다' : '비교 영상 없음'} className="max-w-text">
              분석 폴더에 이전과 이후 영상(before.png, after.png)이 들어오면 이 자리에 표시합니다.
            </StateBlock>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-5">
          <Card title="보는 방법">
            <p className="type-body-sm text-text-sec">가운데 손잡이를 끌거나, 영상을 고른 뒤 방향키로 경계를 옮깁니다.</p>
          </Card>
          {has && (
            <Card title="비교 영상">
              <DefList items={[
                ['이전 시기', `${y0}년 맑은 장면`],
                ['이후 시기', `${y1}년 맑은 장면`],
                ['합성', 'Sentinel-2 L2A 컬러 합성(B04, B03, B02)'],
                ['해상도', '10 m 원본을 확대한 화면입니다.']
              ]} />
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}
