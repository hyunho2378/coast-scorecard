// 미리 TimeAxis.jsx(커밋 800f6aa)의 동작을 가져와 KRDS 변수로 다시 입힘. 미리의 색과 토큰은 쓰지 않음.
// 시간 단위 연속 축 대신 위성 촬영 장면 단위 축. 재생은 anime.js로 장면 번호를 움직이고,
// 움직임 줄이기 설정이면 부드러운 이동 없이 한 장면씩 넘긴다
import { useEffect, useId, useRef } from 'react'
import { animate } from 'animejs'
import { Pause, Play } from 'lucide-react'

const PLAY_MS_PER_STEP = 1100
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function TimeAxis({ index, onIndex, steps, playing, onPlaying }) {
  const id = useId()
  const anim = useRef(null)
  const end = steps.length - 1
  const atEnd = index >= end

  useEffect(() => () => anim.current?.pause(), [])
  useEffect(() => {
    if (!playing) { anim.current?.pause(); anim.current = null; return undefined }
    const start = atEnd ? 0 : index
    if (reduced()) {
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
    <div className="cs-axis">
      <p style={{ margin: 0 }}><strong>{cur?.label}</strong> <span className="cs-head-meta" style={{ display: 'inline' }}>{cur?.sub}</span></p>
      <div className="cs-axis-row">
        <button type="button" className="cs-iconbtn" onClick={() => onPlaying(!playing)} aria-label={playing ? '재생 멈춤' : '장면 차례로 재생'} disabled={end < 1}>
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
        <div className="cs-axis-track">
          <label htmlFor={id} className="sr-only">촬영 장면 선택</label>
          <input id={id} type="range" className="cs-range" min={0} max={Math.max(0, end)} step={1} value={index}
            aria-valuetext={`${cur?.label} ${cur?.sub || ''}`} onChange={(e) => { onPlaying(false); onIndex(Number(e.target.value)) }} />
          <span className="cs-axis-ticks" aria-hidden="true">
            {steps.map((s, i) => s.tick && (
              <span key={s.key} style={{ left: pct(i), transform: i === 0 ? 'none' : i === end ? 'translateX(-100%)' : 'translateX(-50%)' }}>{s.tick}</span>
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
