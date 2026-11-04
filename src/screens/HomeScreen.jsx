// 현황판. 주역은 선택한 사업지의 해안선 지도 한 장. 오른쪽에 큰 숫자 3개와 선택한 가로선 상세, 아래에 가로선 목록.
// 지도의 가로선을 누르면 상세와 목록의 같은 행이 바뀌고, 목록 행을 누르면 지도의 같은 가로선이 굵어진다
import { useEffect, useMemo, useState } from 'react'
import { PageHead, SiteState } from '../ui/index.jsx'
import { ROLE, roleOf } from '../lib/judge.js'
import { fmtDate } from '../lib/ledger.js'
import { BigNumbers, TransectDetail, TransectList, TransectMap, listOrder } from '../parts/transect.jsx'

export function SiteTabs({ sites, siteData, siteId, onSelect }) {
  return (
    <nav className="cs-sitetabs" aria-label="사업지">
      {sites.map((s) => {
        const sm = siteData[s.id]?.summary
        const cur = s.id === siteId
        return (
          <button key={s.id} type="button" aria-current={cur ? 'true' : undefined} className={cur ? 'is-current' : undefined} onClick={() => onSelect(s.id)}>
            <span>{s.name}</span>{sm && <span className={`cs-sitetab-n cs-num${sm.judgeable ? ' is-exceed' : ''}`} aria-label={`변화 확인 구간 ${sm.judgeable}`}>{sm.judgeable}</span>}
          </button>
        )
      })}
    </nav>
  )
}

export default function HomeScreen({ sites, siteData, rules, site, settings, onSelect, onOpen }) {
  const data = siteData[site.id]
  const ready = data?.status === 'ready'
  const first = useMemo(() => (ready ? listOrder(data.rows)[0]?.id ?? null : null), [ready, data])
  const [sel, setSel] = useState(first)
  useEffect(() => { setSel(first) }, [site.id, first])
  const row = ready ? data.rows.find((r) => r.id === sel) : null
  const role = site.run ? '새 분석' : ROLE[roleOf(rules?.data?.site_rules?.[site.id])]

  return (
    <>
      <PageHead title={site.name} meta={<><span>{role}</span>{ready && <span>{fmtDate(data.period.from)}부터 {fmtDate(data.period.to)}까지</span>}{ready && <span>장면 {data.scenes.length}장</span>}</>}
        actions={<button type="button" className="krds-btn small primary" onClick={() => onOpen(site.id, 'card')}>판정 카드</button>} />
      <SiteTabs sites={sites} siteData={siteData} siteId={site.id} onSelect={onSelect} />
      {!ready ? <SiteState data={data} /> : (
        <div className="cs-dash">
          <TransectMap site={site} data={data} selected={sel} onSelect={setSel} extraClass="is-dash" />
          <aside className="cs-dash-side">
            <BigNumbers summary={data.summary} />
            <TransectDetail row={row} settings={settings} />
          </aside>
          <section className="cs-dash-list" aria-label="가로선 목록">
            <h2 className="cs-section-title">가로선 <span className="cs-num">{data.rows.length}</span></h2>
            <TransectList rows={data.rows} selected={sel} onSelect={setSel} />
          </section>
        </div>
      )}
    </>
  )
}
