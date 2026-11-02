// 점검 완료 표시와 메모. 서버 없이 브라우저 저장소에만 둔다
const KEY = 'coast-scorecard.storm-checks.v1'

export function readChecks(store = globalThis.localStorage) {
  try { return JSON.parse(store?.getItem(KEY) || '{}') || {} } catch { return {} }
}
export function writeChecks(map, store = globalThis.localStorage) {
  try { store?.setItem(KEY, JSON.stringify(map)); return true } catch { return false }
}
export const checkKey = (siteId, id) => `${siteId}:${id}`
