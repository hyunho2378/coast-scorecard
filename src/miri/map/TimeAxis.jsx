// 미리 TimeAxis.jsx(커밋 800f6aa)에서 가져와 바꿈. 시간 단위 연속 축 대신 위성 촬영 장면 단위 축으로 바꿨다.
// 재생은 anime.js 로 장면 번호를 움직인다. 움직임 줄이기 설정이면 부드러운 이동 없이 한 장면씩 넘긴다
import { useEffect, useId, useRef } from 'react'
import { animate } from 'animejs'
import clsx from 'clsx'
import { Pause, Play } from 'lucide-react'
import Disclosure from '../ui/Disclosure.jsx'
import IconButton from '../ui/IconButton.jsx'
import { prefersReducedMotion } from '../motion/useReducedMotion.js'

const PLAY_MS_PER_STEP = 1100

export default function TimeAxis({ index, onIndex, steps, playing, onPlaying, summary, caption }) {
  const id = useId()
  const anim = useRef(null)
  const end = steps.length - 1
  const atEnd = index >= end

  useEffect(() => () => anim.current?.pause(), [])

  useEffect(() => {
    if (!playing) { anim.current?.pause(); anim.current = null; return undefined }
    const start = atEnd ? 0 : index
    if (prefersReducedMotion()) {
      let cur = start
      onIndex(cur)
      const timer = setInterval(() => {
        cur = Math.min(end, cur + 1)
        onIndex(cur)
        if (cur >= end) { clearInterval(timer); onPlaying(false) }
      }, PLAY_MS_PER_STEP)
      return () => clearInterval(timer)
    }
    const box = { t: start }
    let last = start
    onIndex(start)
    anim.current = animate(box, {
      t: end,
      duration: Math.max(300, (end - start) * PLAY_MS_PER_STEP),
      ease: 'linear',
      onUpdate: () => { const n = Math.floor(box.t + 1e-6); if (n !== last) { last = n; onIndex(n) } },
      onComplete: () => { onIndex(end); onPlaying(false) }
    })
    return () => anim.current?.pause()
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps

  const pct = (i) => `${end ? (i / end) * 100 : 0}%`
  const cur = steps[index]

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="type-strong text-text-pri tabular-nums">
          {cur.label}
          <span className="ml-2 type-body-sm text-text-meta">{cur.sub}</span>
        </p>
        {summary && <div className="type-body-sm text-text-sec tabular-nums">{summary}</div>}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <IconButton
          variant="soft" size="md" aria-label={playing ? '재생 정지' : '처음부터 재생'}
          onClick={() => onPlaying(!playing)}
        >
          {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
        </IconButton>
        <div className="relative min-w-0 flex-1 pb-6">
          <label htmlFor={id} className="sr-only">촬영 장면 선택</label>
          <input
            id={id} type="range" min={0} max={end} step={1} value={index}
            onChange={(e) => { onPlaying(false); onIndex(Number(e.target.value)) }}
            aria-valuetext={`${cur.label} ${cur.sub}`}
            className="block h-6 w-full cursor-pointer accent-primary"
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-5 h-1">
            {steps.map((s, i) => (
              <span key={s.key} className={clsx('absolute top-0 h-1 w-px', i === index ? 'bg-primary' : 'bg-line-strong')} style={{ left: pct(i) }} />
            ))}
          </span>
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={clsx('absolute top-6 whitespace-nowrap type-meta text-text-meta tabular-nums', i === 0 ? '' : i === end ? '-translate-x-full' : '-translate-x-1/2')}
              style={{ left: pct(i) }}
            >
              {s.tick}
            </span>
          ))}
        </div>
      </div>
      {caption && (
        <Disclosure summary="계산 방식" summaryClassName="type-meta">
          <p className="type-meta text-text-meta">{caption}</p>
        </Disclosure>
      )}
    </div>
  )
}
