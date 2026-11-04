// 전후 위성 영상 비교. 손잡이를 끌거나 영상을 고른 뒤 방향키로 경계를 옮긴다
import { useId, useState } from 'react'
import { Box, Empty, ErrorLine, KV, PageHead, SiteState } from '../ui/index.jsx'

export default function CompareScene({ site, data, onRetry }) {
  const id = useId()
  const [pos, setPos] = useState(50)
  const [broken, setBroken] = useState(false)
  const years = data?.period?.years || []
  const y0 = years[0]
  const y1 = years[years.length - 1]
  const head = <PageHead title={`${site.name} 전후 영상`} meta={y0 ? <><span>이전 {y0}년</span><span>이후 {y1}년</span></> : null} />
  if (!data || data.status === 'loading' || data.status === 'error') return <>{head}<SiteState data={data} onRetry={onRetry} /></>
  const has = data.before && data.after && !broken

  return (
    <>
      {head}
      <div className="cs-two">
        <Box flush>
          {has ? (
            <div className="cs-box-body">
              <div className="cs-compare">
                <img src={data.before} onError={() => setBroken(true)} alt={`${site.name} ${y0}년 위성 영상`} draggable="false" />
                <img src={data.after} onError={() => setBroken(true)} alt={`${site.name} ${y1}년 위성 영상`} draggable="false" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
                <span className="cs-compare-line" style={{ left: `${pos}%` }} aria-hidden="true" />
                <span className="cs-compare-tag" style={{ left: 'var(--krds-gap-4)' }}>{y0}년</span>
                <span className="cs-compare-tag" style={{ right: 'var(--krds-gap-4)' }}>{y1}년</span>
                <label htmlFor={id} className="sr-only">비교 경계 위치</label>
                <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} />
              </div>
            </div>
          ) : broken ? <ErrorLine>영상 읽기 실패</ErrorLine> : <Empty>전후 영상 없음</Empty>}
        </Box>
        <aside className="cs-col">
          <Box title="비교 영상">
            <KV items={[
              ['이전', `${y0}년`],
              ['이후', `${y1}년`],
              ['합성', 'Sentinel-2 L2A 참색(B04, B03, B02)'],
              ['출처', 'Contains modified Copernicus Sentinel data']

            ]} />
          </Box>
        </aside>
      </div>
    </>
  )
}
