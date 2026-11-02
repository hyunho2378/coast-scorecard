// 폭풍 뒤 점검 목록. 판정 가능하고 변화가 큰 가로선부터. 폭풍 직후에는 구름이 끼므로 첫 맑은 장면 뒤에 쓰는 목록이다
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Card, Chip, PageHeader, TestBadge, StateBlock, Button, RESPONSIBILITY } from '../ui/index.jsx'
import { stormOrder } from '../lib/judge.js'
import { readChecks, writeChecks, checkKey } from '../lib/checks.js'
import { fmtDate } from '../lib/ledger.js'

export default function StormScreen({ sites, siteData, storms, onOpen }) {
  const [checks, setChecks] = useState(readChecks)
  const [saved, setSaved] = useState(true)
  useEffect(() => { setSaved(writeChecks(checks)) }, [checks])

  const loading = sites.some((s) => (siteData[s.id]?.status || 'loading') === 'loading')
  const ready = sites.filter((s) => siteData[s.id]?.status === 'ready').map((s) => ({ ...s, rows: siteData[s.id].rows }))
  const list = useMemo(() => stormOrder(ready), [siteData]) // eslint-disable-line react-hooks/exhaustive-deps
  const heldTotal = ready.reduce((a, s) => a + siteData[s.id].summary.held, 0)
  const done = list.filter((r) => checks[checkKey(r.siteId, r.id)]?.done).length

  const set = (k, patch) => setChecks((m) => ({ ...m, [k]: { ...m[k], ...patch } }))

  return (
    <>
      <PageHeader title="폭풍 뒤 점검 목록" badges={<TestBadge />}
        desc="첫 맑은 장면 뒤 2차 점검과 대장 근거용 목록입니다. 폭풍 직후 며칠은 구름이 끼어 위성 장면을 쓰기 어렵습니다."
        action={list.length > 0 && <p className="type-strong text-text-sec tabular-nums">점검 완료 {done} / {list.length}</p>} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          {loading && <StateBlock kind="loading">사업지 자료를 모두 읽은 뒤 순서를 정합니다.</StateBlock>}
          {!loading && !list.length && <StateBlock kind="empty" title="판정 가능 가로선 없음">연결한 사업지에 판정 가능 가로선이 없습니다.</StateBlock>}
          {!saved && <StateBlock kind="error" title="브라우저 저장소에 저장하지 못했습니다">사생활 보호 창에서는 점검 표시가 남지 않을 수 있습니다.</StateBlock>}
          <ol className="flex flex-col gap-2">
            {list.map((r, i) => {
              const k = checkKey(r.siteId, r.id)
              const c = checks[k] || {}
              return (
                <li key={k} className={clsx('rounded-md p-4', c.done ? 'bg-subtle' : 'bg-canvas')}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="w-8 shrink-0 type-h3 text-text-sec tabular-nums">{i + 1}</span>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={Boolean(c.done)} onChange={(e) => set(k, { done: e.target.checked, at: e.target.checked ? new Date().toISOString() : null })} />
                      <span className="type-strong text-text-pri">{r.siteName} 가로선 {r.id}</span>
                    </label>
                    <Chip tone={r.verdict}>{r.verdict === 'advance' ? '전진' : '후퇴'}</Chip>
                    <span className="type-strong text-text-pri tabular-nums">{r.change > 0 ? '+' : ''}{r.change.toFixed(1)} m</span>
                    <span className="type-meta text-text-meta">보류 기준 {r.threshold} m</span>
                    <Button variant="ghost" className="ml-auto" onClick={() => onOpen(r.siteId)}>지도에서 보기</Button>
                  </div>
                  <div className="mt-2 pl-12">
                    <label htmlFor={`memo-${k}`} className="sr-only">{r.siteName} 가로선 {r.id} 메모</label>
                    <input id={`memo-${k}`} type="text" value={c.memo || ''} onChange={(e) => set(k, { memo: e.target.value })} placeholder="현장 확인 메모"
                      className="min-h-11 w-full rounded-sm bg-mute px-3 type-body-sm text-text-pri placeholder:text-text-ter" />
                    {c.done && c.at && <p className="mt-1 type-meta text-text-meta">점검 완료 표시 {fmtDate(c.at)}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Card title="점검 순서 기준">
            <p className="type-body-sm text-text-sec">판정 가능 가로선만 모으고, 변화 크기가 큰 가로선을 위에 둡니다.</p>
            <p className="mt-2 type-body-sm text-text-sec">판정 보류 가로선 {heldTotal}개는 이 목록에서 빼고 현장 측량으로 확인합니다.</p>
            <p className="mt-2 type-meta text-text-meta">점검 표시와 메모는 이 브라우저에만 저장합니다.</p>
          </Card>
          <Card title="기상특보 이력" action={<Chip tone="sand">{storms?.label || '샘플 데이터'}</Chip>}>
            <ul className="flex flex-col gap-2">
              {(storms?.items || []).map((it) => (
                <li key={it.region + it.from} className="rounded-sm bg-mute px-3 py-2">
                  <p className="type-strong text-text-pri">{it.kind}</p>
                  <p className="type-meta text-text-meta">{it.region}, {fmtDate(it.from)}부터 {fmtDate(it.to)}까지</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 type-meta text-text-meta">실제 특보 조회 결과가 아닌 예시 이력입니다.</p>
          </Card>
          <p className="rounded-md bg-canvas px-5 py-4 type-body-sm text-text-pri">{RESPONSIBILITY}</p>
        </aside>
      </div>
    </>
  )
}
