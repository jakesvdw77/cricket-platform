import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PublicPollHeader } from './PublicPollHeader'

describe('PublicPollHeader', () => {
  it('shows Open with the close time, the title and the context', () => {
    render(
      <PublicPollHeader
        open
        title="Over 40 fixtures"
        subtitle="Thursday 15 October · 2 matches"
        details={['Premier League', null, '2026/27']}
        scheduledCloseAt="2030-10-14T07:15:00Z"
      />,
    )
    expect(screen.getByText(/^Open · closes /)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Over 40 fixtures' })).toBeInTheDocument()
    expect(screen.getByText('Thursday 15 October · 2 matches')).toBeInTheDocument()
    expect(screen.getByText('Premier League')).toBeInTheDocument()
    expect(screen.getByText('2026/27')).toBeInTheDocument()
  })

  it('shows plain Open when nothing is scheduled', () => {
    render(<PublicPollHeader open title="T" />)
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('shows Closed without a close time', () => {
    render(<PublicPollHeader open={false} title="T" scheduledCloseAt="2030-10-14T07:15:00Z" />)
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.queryByText(/closes/)).not.toBeInTheDocument()
  })
})
