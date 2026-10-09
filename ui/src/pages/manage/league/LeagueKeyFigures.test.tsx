import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeagueKeyFigures } from './LeagueKeyFigures'

const NOW = new Date('2026-10-09T12:00:00')
const base = { teamCount: 8, matchCount: 56, playedCount: 12, nextMatchDate: '2026-10-15T07:15:00', maxPlayingXiSize: 11, minAge: null, maxAge: null }

describe('LeagueKeyFigures', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('shows the teams, the matches played, the next match with its countdown and the Playing XI', () => {
    render(<LeagueKeyFigures {...base} />)

    expect(screen.getByTestId('league-figure-teams-value')).toHaveTextContent('8')
    expect(screen.getByTestId('league-figure-played-value')).toHaveTextContent('12 of 56')
    expect(screen.getByTestId('league-figure-next')).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByText(/in 5 days/)).toBeInTheDocument()
    expect(screen.getByTestId('league-figure-xi-value')).toHaveTextContent('11')
    expect(screen.getByText('Playing XI')).toBeInTheDocument()
  })

  it('turns the next match amber within 24 hours', () => {
    render(<LeagueKeyFigures {...base} nextMatchDate="2026-10-09T18:00:00" />)
    expect(screen.getByTestId('league-figure-next')).toHaveAttribute('data-tone', 'warning')
  })

  it('shows dashes and the reason when nothing is scheduled, and says so when every match is played', () => {
    const { unmount } = render(<LeagueKeyFigures {...base} teamCount={0} matchCount={0} playedCount={0} nextMatchDate={null} />)
    expect(screen.getByTestId('league-figure-teams-value')).toHaveTextContent('–')
    expect(screen.getByTestId('league-figure-played-value')).toHaveTextContent('–')
    expect(screen.getByText('No matches scheduled yet')).toBeInTheDocument()
    unmount()

    render(<LeagueKeyFigures {...base} matchCount={10} playedCount={10} nextMatchDate={null} />)
    expect(screen.getByText('No more matches this season')).toBeInTheDocument()
  })

  it('puts the age range in the Playing XI caption, with "any" for a missing bound', () => {
    const { unmount } = render(<LeagueKeyFigures {...base} minAge={40} maxAge={null} />)
    expect(screen.getByText('Playing XI · age 40–any')).toBeInTheDocument()
    unmount()

    render(<LeagueKeyFigures {...base} minAge={null} maxAge={null} />)
    expect(screen.getByText('Playing XI')).toBeInTheDocument()
  })
})
