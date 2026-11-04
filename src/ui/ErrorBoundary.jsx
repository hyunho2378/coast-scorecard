// 화면 오류 경계. 한 화면에서 그리기 오류가 나도 메뉴와 머리는 남기고 안내 줄과 다시 시도 단추를 보인다.
// 화면이나 사업지가 바뀌면(resetKey) 오류 상태를 지우고 새로 그린다
import { Component, Fragment } from 'react'
import { Box, ErrorLine } from './index.jsx'
import { boundaryFromError, boundaryFromProps, boundaryRetry } from '../lib/guard.js'

export const BOUNDARY_TEXT = '화면을 그리지 못했습니다. 다시 시도하면 같은 화면을 새로 그립니다.'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, key: props.resetKey }
    this.retry = this.retry.bind(this)
  }
  static getDerivedStateFromError(error) { return boundaryFromError(error) }
  static getDerivedStateFromProps(props, state) { return boundaryFromProps(props, state) }
  componentDidCatch(error, info) { console.error('화면 오류', error, info?.componentStack) }
  retry() { this.setState(boundaryRetry) }
  render() {
    if (!this.state.error) return <Fragment key={this.state.round || 0}>{this.props.children}</Fragment>
    return <Box flush><ErrorLine onRetry={this.retry} retryLabel="다시 시도">{BOUNDARY_TEXT}</ErrorLine></Box>
  }
}
