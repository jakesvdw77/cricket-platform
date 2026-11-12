import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HubLiveActions } from './HubLiveActions'

// Owner, 2026-11-12: Watch Live then the score slot, each only when it applies.
const renderActions = (props: Partial<Parameters<typeof HubLiveActions>[0]> = {}) =>
  render(
    <MemoryRouter>
      <HubLiveActions playerKey="k1" matchId="m1" hasStream={false} {...props} />
    </MemoryRouter>,
  )

describe('HubLiveActions', () => {
  it('shows Watch Live only with a stream, and keeps where the list was in `from`', () => {
    renderActions({ hasStream: true, from: 'matches:live' })

    expect(screen.getByRole('link', { name: 'Watch Live' })).toHaveAttribute('href', '/account/players/k1/schedule/matches/m1/watch?from=matches%3Alive')
  })

  it('omits the from parameter when none is given', () => {
    renderActions({ hasStream: true })

    expect(screen.getByTestId('watch-live')).toHaveAttribute('href', '/account/players/k1/schedule/matches/m1/watch')
  })

  it('shows the score slot only when given, without Watch Live when there is no stream', () => {
    renderActions({ score: <a href="https://scores.example">Live Score</a> })

    expect(screen.getByRole('link', { name: 'Live Score' })).toBeInTheDocument()
    expect(screen.queryByTestId('watch-live')).not.toBeInTheDocument()
  })

  it('draws nothing with neither a stream nor a score', () => {
    const { container } = renderActions()

    expect(container).toBeEmptyDOMElement()
  })
})
