import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Typography } from '@mui/material'
import { STATS_TYPE } from './statsCardStyle'

// docs/specs/147: one broken card face (a payload from an older backend, a null block) shows the quiet missing text and never takes the page
// down. Logs nothing noisy. Imports no card.
interface Props {
  text: string
  children: ReactNode
}

export class StatsFaceBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately silent.
  }

  render() {
    if (this.state.failed) return <Typography sx={{ fontSize: STATS_TYPE.body, m: 0 }}>{this.props.text}</Typography>
    return this.props.children
  }
}
