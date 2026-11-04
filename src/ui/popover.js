// 메뉴 열고 닫기. 바깥 누름과 Esc 로 닫고 위아래 화살표로 항목을 옮긴다
import { useEffect, useRef, useState } from 'react'

export function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const btn = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const first = ref.current?.querySelector('[aria-checked="true"]') || ref.current?.querySelector('button')
    first?.focus()
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...ref.current.querySelectorAll('button')]
        const i = items.indexOf(document.activeElement)
        const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]
        next?.focus(); e.preventDefault()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen, ref, btn }
}

