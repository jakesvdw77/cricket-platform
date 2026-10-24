import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { StatusScreen } from '../StatusScreen'

// App-level error boundary: a render crash shows the cricket "Dropped catch" screen instead of an empty page.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected error', error, info.componentStack)
  }

  render() {
    if (this.state.failed) return <StatusScreen kind="error" />
    return this.props.children
  }
}
