// 사이트 설정(public/config/sites.json)에 선언한 파일 후보를 앞에서부터 읽는다.
// 처음 열리는 파일을 쓰고, 어떤 후보에서 왔는지(origin)를 함께 돌려준다
// 외부 분석 폴더(/ext/poc2/)에 실제로 있는 파일 목록. 개발 서버가 아니면 빈 목록
let extList = null
async function externalFiles() {
  if (extList) return extList
  try {
    const res = await fetch('/ext/poc2/__list', { cache: 'no-store' })
    const type = res.headers.get('content-type') || ''
    extList = res.ok && type.includes('json') ? new Set(await res.json()) : new Set()
  } catch {
    extList = new Set()
  }
  return extList
}

async function firstOk(urls, kind) {
  const ext = await externalFiles()
  for (const url of urls || []) {
    if (url.startsWith('/ext/') && !ext.has(url)) continue
    try {
      const res = await fetch(url, { method: kind === 'image' ? 'HEAD' : 'GET', cache: 'no-store' })
      const type = res.headers.get('content-type') || ''
      if (!res.ok || type.includes('text/html')) continue
      if (kind === 'image') return { url, origin: url.startsWith('/ext/') ? 'poc2' : 'local' }
      return { data: await res.json(), url, origin: url.startsWith('/ext/') ? 'poc2' : 'local' }
    } catch {
      // 다음 후보로 넘어간다
    }
  }
  return null
}

export async function loadConfig() {
  const [sites, judge, schedule, omm] = await Promise.all(
    ['/config/sites.json', '/config/judgement.json', '/data/acquisition_sample.json', '/data/omm_sample.json'].map((u) => fetch(u).then((r) => r.json()))
  )
  return { sites: sites.sites, judge, schedule, omm }
}

export async function loadSite(site) {
  extList = null // 사업지를 열 때마다 폴더를 다시 확인한다
  const f = site.files || {}
  const [shorelines, transects, before, after, overlay] = await Promise.all([
    firstOk(f.shorelines, 'json'), firstOk(f.transects, 'json'),
    firstOk(f.before, 'image'), firstOk(f.after, 'image'), firstOk(f.overlay, 'image')
  ])
  return { shorelines, transects, before, after, overlay, ready: Boolean(shorelines && transects) }
}
