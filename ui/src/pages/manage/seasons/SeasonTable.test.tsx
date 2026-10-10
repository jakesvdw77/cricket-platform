import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SeasonTable } from './SeasonTable'
import type { Season, SeasonSummary } from '../../../api/seasonApi'

const TODAY = '2026-10-10'

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'club-1',
    label: '2026/27',
    startDate: '2026-09-01',
    endDate: '2027-03-31',
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

const SUMMARIES: Record<string, SeasonSummary> = {
  'season-1': { seasonId: 'season-1', leagueCount: 2, teamsEntered: 5, matchCount: 48 },
  'season-2': { seasonId: 'season-2', leagueCount: 0, teamsEntered: 0, matchCount: 0 },
}

function renderTable(seasons: Season[], summaries: Record<string, SeasonSummary> | null = SUMMARIES) {
  return render(
    <MemoryRouter>
      <SeasonTable seasons={seasons} summaries={summaries} today={TODAY} />
    </MemoryRouter>,
  )
}

describe('SeasonTable', () => {
  it('renders the header and a row per season with its dates, status and figures', () => {
    renderTable([makeSeason(), makeSeason({ id: 'season-2', label: '2025/26', startDate: '2025-09-01', endDate: '2026-03-31' })])

    expect(screen.getByRole('table', { name: 'Seasons' })).toBeInTheDocument()
    for (const name of ['Season', 'Dates', 'Status', 'Leagues', 'Teams', 'Matches']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    const [first, second] = screen.getAllByTestId('season-row')
    expect(within(first).getByTestId('season-row-dates')).toHaveTextContent('1 Sep 2026 to 31 Mar 2027')
    expect(within(first).getByTestId('season-row-status')).toHaveTextContent('Current')
    expect(within(first).getByTestId('season-row-leagues')).toHaveTextContent('2')
    expect(within(first).getByTestId('season-row-teams')).toHaveTextContent('5')
    expect(within(first).getByTestId('season-row-matches')).toHaveTextContent('48')
    expect(within(second).getByTestId('season-row-status')).toHaveTextContent('Past')
    expect(within(second).getByTestId('season-row-leagues')).toHaveTextContent('0')
  })

  it('shows Upcoming and Inactive statuses', () => {
    renderTable([makeSeason({ startDate: '2026-11-01' }), makeSeason({ id: 'season-2', active: false })])

    const [upcoming, inactive] = screen.getAllByTestId('season-row')
    expect(within(upcoming).getByTestId('season-row-status')).toHaveTextContent('Upcoming')
    expect(within(inactive).getByTestId('season-row-status')).toHaveTextContent('Inactive')
  })

  it('shows dashes for the figures while the summary is not available', () => {
    renderTable([makeSeason()], null)

    const row = screen.getByTestId('season-row')
    for (const id of ['season-row-leagues', 'season-row-teams', 'season-row-matches']) {
      expect(within(row).getByTestId(id)).toHaveTextContent('-')
    }
  })

  it('keeps the desktop-only columns marked so a phone can drop them, with the status badge under the name', () => {
    renderTable([makeSeason()])

    const row = screen.getByTestId('season-row')
    for (const id of ['season-row-status', 'season-row-leagues', 'season-row-teams', 'season-row-matches']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
    expect(within(row).getByTestId('season-row-dates')).not.toHaveAttribute('data-desktop-only')
    expect(within(row).getByTestId('season-row-phone-status')).toHaveTextContent('Current')
  })

  it('links the whole row to the season', () => {
    renderTable([makeSeason({ id: 'season-9' })])
    expect(screen.getByRole('link', { name: '2026/27' })).toHaveAttribute('href', '/manage/fixtures/seasons/season-9')
  })
})
