// 장면 3. 전후 위성 영상 비교 슬라이더(직접 구현). 영상이 없으면 해안선 그림으로 대체한다
import { useId, useState } from 'react'

export default function CompareScene({ site, data }) {
  const id = useId()
  const [pos, setPos] = useState(50)
  const has = data?.before && data?.after
  const scenes = data?.shorelines?.data.features.map((f) => f.properties.date) || []
  const fmt = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${y}. ${Number(m)}. ${Number(dd)}.` }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-md bg-text-pri p-4">
        {has ? (
          <div className="relative aspect-[8/9] h-full max-h-full select-none overflow-hidden rounded-md">
            <img src={data.before.url} alt={`이전 시점 위성 영상 ${fmt(scenes[0])}`} className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]" draggable="false" />
            <img src={data.after.url} alt={`이후 시점 위성 영상 ${fmt(scenes[2])}`} className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} draggable="false" />
            <span className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-page" style={{ left: `${pos}%` }} aria-hidden="true" />
            <span className="pointer-events-none absolute top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-page shadow-md" style={{ left: `${pos}%` }} aria-hidden="true" />
            <span className="absolute left-3 top-3 rounded-md bg-text-pri px-3 py-1 type-caption text-text-inverse">이전 {fmt(scenes[0])}</span>
            <span className="absolute right-3 top-3 rounded-md bg-primary px-3 py-1 type-caption text-text-inverse">이후 {fmt(scenes[2])}</span>
            <label htmlFor={id} className="sr-only">비교 경계 위치</label>
            <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
          </div>
        ) : data?.overlay ? (
          <img src={data.overlay.url} alt="해안선 변화 그림" className="max-h-full rounded-md" />
        ) : (
          <p className="type-body text-text-inverse">비교 영상 준비 중</p>
        )}
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-auto">
        <section className="rounded-md bg-canvas p-4">
          <h2 className="type-h3 text-text-pri">{site.name}</h2>
          <p className="mt-1 type-body-sm text-text-sec">가운데 손잡이를 끌거나<br />방향키로 경계를 옮깁니다.</p>
        </section>
        {has && (
          <section className="rounded-md bg-canvas p-4">
            <h3 className="type-strong text-text-pri">비교 장면</h3>
            <ul className="mt-2 flex flex-col gap-1 type-body-sm text-text-pri tabular-nums">
              <li className="flex justify-between"><span>이전 시점</span><span>{fmt(scenes[0])}</span></li>
              <li className="flex justify-between"><span>이후 시점</span><span>{fmt(scenes[2])}</span></li>
            </ul>
            <p className="mt-2 type-meta text-text-meta">Sentinel-2 L2A 컬러 합성(B04, B03, B02)<br />10 m 해상도 원본을 4배 확대한 화면입니다.</p>
          </section>
        )}
        {data?.overlay && (
          <section className="rounded-md bg-canvas p-4">
            <h3 className="type-strong text-text-pri">해안선 겹침 그림</h3>
            <img src={data.overlay.url} alt="2017년 해안선과 2025년 해안선 겹침 그림" className="mt-2 w-full rounded-md" />
            <p className="mt-2 type-meta text-text-meta">빨강 2017년 해안선, 파랑 2025년 해안선<br />흰 선 가로선 16개</p>
          </section>
        )}
      </aside>
    </div>
  )
}
