import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeagueKeyFigures } from './LeagueKeyFigures'

const NOW = new Date('2026-10-09T12:00:00')
const valueOf = (id: string) => within(screen.getByTestId(id)).getByTestId('page-counter-value')
const base = { teamCount: 8, matchCount: 56, playedCount: 12, nextMatchDate: '2026-10-15T07:15:00', maxPlayingXiSize: 11, minAge: null, maxAge: null }

describe('LeagueKeyFigures', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('shows the teams, the matches played, the next match with its countdown and the Playing XI as static compact counters', () => {
    render(<MemoryRouter><LeagueKeyFigures {...base} /></MemoryRouter>)

    expect(valueOf('league-figure-teams')).toHaveTextContent('8')
    expect(screen.getByTestId('league-figure-teams')).toHaveTextContent('Teams')
    expect(valueOf('league-figure-played')).toHaveTextContent('12 of 56')
    expect(screen.getByTestId('league-figure-next')).toHaveTextContent(/Next match .*in 5 days/)
    expect(valueOf('league-figure-xi')).toHaveTextContent('11')
    expect(screen.getByTestId('league-figure-xi')).toHaveTextContent('11Playing XI')
    // Static: plain cards, no buttons, no FILTER tag.
    expect(screen.getByTestId('league-key-figures').querySelectorAll('button')).toHaveLength(0)
    expect(screen.queryByText('filter')).not.toBeInTheDocument()
  })

  it('turns the next match amber within 24 hours', () => {
    const { unmount } = render(<MemoryRouter><LeagueKeyFigures {...base} /></MemoryRouter>)
    const calm = getComputedStyle(valueOf('league-figure-next')).color
    unmount()
    render(<MemoryRouter><LeagueKeyFigures {...base} nextMatchDate="2026-10-09T18:00:00" /></MemoryRouter>)
    expect(getComputedStyle(valueOf('league-figure-next')).color).not.toBe(calm)
  })

  it('shows dashes and the reason when nothing is scheduled, and says so when every match is played', () => {
    const { unmount } = render(<MemoryRouter><LeagueKeyFigures {...base} teamCount={0} matchCount={0} playedCount={0} nextMatchDate={null} /></MemoryRouter>)
    expect(valueOf('league-figure-teams')).toHaveTextContent('–')
    expect(valueOf('league-figure-played')).toHaveTextContent('–')
    expect(screen.getByText('No matches scheduled yet')).toBeInTheDocument()
    unmount()

    render(<MemoryRouter><LeagueKeyFigures {...base} matchCount={10} playedCount={10} nextMatchDate={null} /></MemoryRouter>)
    expect(screen.getByText('No more matches this season')).toBeInTheDocument()
  })

  it('puts the age range in the Playing XI caption, with "any" for a missing bound', () => {
    const { unmount } = render(<MemoryRouter><LeagueKeyFigures {...base} minAge={40} maxAge={null} /></MemoryRouter>)
    expect(screen.getByText('Playing XI · age 40-any')).toBeInTheDocument()
    unmount()

    render(<MemoryRouter><LeagueKeyFigures {...base} minAge={null} maxAge={null} /></MemoryRouter>)
    expect(screen.getByText('Playing XI')).toBeInTheDocument()
  })

  it('keeps the age reference date out of the cards and in a focusable info icon tooltip after the Playing XI caption', () => {
    const ageReference = { referenceDate: '2026-09-13', source: 'LEAGUE_START' as const, leagueStart: '2026-09-13', leagueStartSource: 'LEAGUE_SEASON_DATES' as const }
    render(<MemoryRouter><LeagueKeyFigures {...base} minAge={40} ageReference={ageReference} /></MemoryRouter>)
    expect(screen.queryByText(/Ages judged on/)).not.toBeInTheDocument()
    const info = screen.getByTestId('league-figure-xi-info')
    expect(info).toHaveAttribute('aria-label', "Ages are judged on 13 Sep 2026 (the league's start date)")
    expect(info).toHaveAttribute('tabindex', '0')
    expect(screen.getByTestId('league-figure-xi')).toContainElement(info)
  })

  it('is four separate compact counter cards', () => {
    render(<MemoryRouter><LeagueKeyFigures {...base} /></MemoryRouter>)
    expect(screen.getByTestId('league-key-figures').firstElementChild?.children).toHaveLength(4)
  })

  it('shows no age note without an age rule', () => {
    const ageReference = { referenceDate: '2026-09-13', source: 'CUTOFF' as const, leagueStart: '2026-09-13', leagueStartSource: 'FIRST_MATCH' as const }
    render(<MemoryRouter><LeagueKeyFigures {...base} ageReference={ageReference} /></MemoryRouter>)
    expect(screen.queryByTestId('league-figure-xi-info')).not.toBeInTheDocument()
  })
})
