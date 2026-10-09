import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchKeyFigures } from './MatchKeyFigures'
import type { MatchPoll } from '../../../api/matchApi'

const NOW = new Date('2026-10-09T12:00:00')
const base = {
  venue: 'Riverside Oval',
  leagueName: 'TVL Division 1 T20',
  seasonLabel: '2026/2027',
  pollsReady: true,
  polls: [] as MatchPoll[],
  pollClosesAt: null as string | null,
}
const squadPoll = (open: boolean): MatchPoll => ({ type: 'SQUAD', teamId: 't1', pollId: 'p1', roundId: null, open })

describe('MatchKeyFigures', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('shows the venue, league with season, and the start as neutral when it is days away', () => {
    render(<MatchKeyFigures {...base} matchDate="2026-10-15T07:15:00" />)
    expect(screen.getByTestId('match-figure-venue-value')).toHaveTextContent('Riverside Oval')
    expect(screen.getByTestId('match-figure-league-value')).toHaveTextContent('TVL Division 1 T20')
    expect(screen.getByText('League · 2026/2027')).toBeInTheDocument()
    expect(screen.getByTestId('match-figure-starts')).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByText(/in 5 days/)).toBeInTheDocument()
  })

  it('turns the Starts tile amber within 24 hours', () => {
    render(<MatchKeyFigures {...base} matchDate="2026-10-09T18:00:00" />)
    expect(screen.getByTestId('match-figure-starts')).toHaveAttribute('data-tone', 'warning')
  })

  it('says Played once the match has started, with no countdown', () => {
    render(<MatchKeyFigures {...base} matchDate="2026-10-09T08:00:00" />)
    expect(screen.getByText(/^Played/)).toBeInTheDocument()
    expect(screen.getByTestId('match-figure-starts')).toHaveAttribute('data-tone', 'neutral')
  })

  it('shows TBC for no venue and Friendly for no league', () => {
    render(<MatchKeyFigures {...base} venue={null} leagueName={null} matchDate="2026-10-15T07:15:00" />)
    expect(screen.getByTestId('match-figure-venue-value')).toHaveTextContent('TBC')
    expect(screen.getByTestId('match-figure-league-value')).toHaveTextContent('Friendly')
  })

  it('shows the poll as None, Open (with its close time) and Closed', () => {
    const { rerender } = render(<MatchKeyFigures {...base} matchDate="2026-10-15T07:15:00" />)
    expect(screen.getByTestId('match-figure-poll-value')).toHaveTextContent('None')
    expect(screen.getByText('No poll yet')).toBeInTheDocument()

    rerender(<MatchKeyFigures {...base} matchDate="2026-10-15T07:15:00" polls={[squadPoll(true)]} pollClosesAt="2026-10-14T18:00:00" />)
    expect(screen.getByTestId('match-figure-poll-value')).toHaveTextContent('Open')
    expect(screen.getByText(/^Closes /)).toBeInTheDocument()

    rerender(<MatchKeyFigures {...base} matchDate="2026-10-15T07:15:00" polls={[squadPoll(true)]} />)
    expect(screen.getByText('1 poll')).toBeInTheDocument()

    rerender(<MatchKeyFigures {...base} matchDate="2026-10-15T07:15:00" polls={[squadPoll(false)]} />)
    expect(screen.getByTestId('match-figure-poll-value')).toHaveTextContent('Closed')
  })

  it('shows a dash for the poll until the polls have loaded', () => {
    render(<MatchKeyFigures {...base} pollsReady={false} matchDate="2026-10-15T07:15:00" />)
    expect(screen.getByTestId('match-figure-poll-value')).toHaveTextContent('–')
  })
})
