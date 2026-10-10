import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeagueTable } from './LeagueTable'
import type { League } from '../../../api/leagueApi'

const NOW = new Date('2026-10-09T12:00:00')

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'club-1',
    name: 'TVL Division 1',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    currentSeasonTeamCount: 8,
    currentSeasonLabel: '2026/2027',
    currentSeasonPlayingConditionsUrl: null,
    matchCount: 56,
    playedCount: 12,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: '2026-10-15T07:15:00',
    teams: Array.from({ length: 8 }, (_, i) => ({ name: `Team ${i}`, abbreviation: null, logoUrl: null, own: i < 2 })),
    format: 'T20',
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
    ...overrides,
  }
}

function renderTable(leagues: League[], seasonId?: string) {
  return render(
    <MemoryRouter>
      <LeagueTable leagues={leagues} seasonId={seasonId} />
    </MemoryRouter>,
  )
}

describe('LeagueTable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('renders the header and a row per league with its format, team count, next match and played figures', () => {
    renderTable([makeLeague(), makeLeague({ id: 'league-2', name: 'Vets League', format: null })])

    expect(screen.getByRole('table', { name: 'Leagues' })).toBeInTheDocument()
    for (const name of ['League', 'Format', 'Teams', 'Next match', /Matches played/, 'Status']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    const [first, second] = screen.getAllByTestId('league-row')
    expect(within(first).getByTestId('league-row-format')).toHaveTextContent('T20')
    expect(within(first).getByTestId('league-row-teams')).toHaveTextContent('8')
    expect(within(first).getByTestId('league-row-next')).toHaveTextContent(/in 5 days/)
    expect(within(first).getByTestId('league-row-played')).toHaveTextContent('12 of 56')
    expect(within(first).getByTestId('league-row-status')).toHaveTextContent('Active')
    expect(within(second).getByTestId('league-row-format')).toHaveTextContent('–')
  })

  it('turns a row amber within 24 hours of the next match, and shows dashes with none', () => {
    renderTable([
      makeLeague({ id: 'soon', nextMatchDate: '2026-10-09T18:00:00' }),
      makeLeague({ id: 'none', nextMatchDate: null, matchCount: 0, playedCount: 0, teams: [] }),
    ])

    const [soon, none] = screen.getAllByTestId('league-row')
    expect(soon).toHaveAttribute('data-tone', 'warning')
    expect(none).toHaveAttribute('data-tone', 'neutral')
    expect(within(none).getByTestId('league-row-next')).toHaveTextContent('–')
    expect(within(none).getByTestId('league-row-played')).toHaveTextContent('–')
    expect(within(none).getByTestId('league-row-teams')).toHaveTextContent('–')
  })

  // docs/specs/096-duplicate-league.md: no row-level Duplicate; it lives on the league page header and the edit page.
  it('has no Duplicate control', () => {
    renderTable([makeLeague(), makeLeague({ id: 'league-2', name: 'Vets League' })])

    expect(screen.queryByText(/duplicate/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /duplicate/i })).not.toBeInTheDocument()
  })

  it('shows Inactive for a retired league', () => {
    renderTable([makeLeague({ active: false })])
    expect(screen.getByTestId('league-row-status')).toHaveTextContent('Inactive')
  })

  it('keeps the desktop-only columns marked so a phone can drop them, and shows the phone played figure', () => {
    renderTable([makeLeague()])

    const row = screen.getByTestId('league-row')
    for (const id of ['league-row-format', 'league-row-teams', 'league-row-next', 'league-row-status']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
    expect(within(row).getByTestId('league-row-played')).not.toHaveAttribute('data-desktop-only')
    expect(within(row).getByText('12/56')).toBeInTheDocument()
    expect(within(row).getByTestId('league-row-phone-meta')).toHaveTextContent('T20 · Active')
  })

  it('links the whole row to the league Schedule, carrying the chosen season', () => {
    renderTable([makeLeague({ id: 'league-9' })], 'season-2')
    expect(screen.getByRole('link', { name: 'TVL Division 1' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-9/schedule?seasonId=season-2',
    )
  })
})
