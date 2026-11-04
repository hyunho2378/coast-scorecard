// 화면 보호 도우미. 지도 자료 갱신 전 확인과 화면 오류 경계 상태 계산을 React 없이 둔다(시험에서 바로 부른다)

// 사업지를 바꾸면 지도를 새로 만들고, 이전 지도의 loaded 값이 한 번 남은 채 갱신 효과가 돈다.
// 새 지도의 자료 원본(source)과 층(layer)이 모두 생긴 뒤에만 갱신한다
export function mapReady(m, loaded, sources = [], layers = []) {
  if (!loaded || !m || typeof m.getSource !== 'function') return false
  if (sources.some((id) => !m.getSource(id))) return false
  if (layers.some((id) => typeof m.getLayer !== 'function' || !m.getLayer(id))) return false
  return true
}

// 오류 경계 상태. 오류가 나면 error 를 채우고, 화면이나 사업지가 바뀌면(resetKey) 비운다. 다시 시도는 round 를 올려 새로 그린다
export const boundaryFromError = (error) => ({ error: error || new Error('render') })
export const boundaryFromProps = (props, state) => (props.resetKey !== state.key ? { error: null, key: props.resetKey } : null)
export const boundaryRetry = (state) => ({ error: null, round: (state.round || 0) + 1 })
