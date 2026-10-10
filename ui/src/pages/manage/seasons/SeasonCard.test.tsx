import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Season, SeasonSummary } from '../../../api/seasonApi'
import { SeasonCard } from './SeasonCard'

const TODAY = '2026-10-10'

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'club-1',
    label: '2026/27',
    startDate: '2026-09-01',
    endDate: '2027-03-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const SUMMARY: SeasonSummary = { seasonId: 'season-1', leagueCount: 2, teamsEntered: 5, matchCount: 48 }

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderCard(season: Season, summary: SeasonSummary | null = SUMMARY) {
  return render(
    <MemoryRouter initialEntries={['/list']}>
      <Routes>
        <Route path="/list" element={<SeasonCard season={season} summary={summary} today={TODAY} />} />
        <Route path="*" element={<div>Elsewhere</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

function chipLabels(): string[] {
  return Array.from(document.querySelectorAll('.MuiChip-label')).map((el) => el.textContent ?? '')
}

describe('SeasonCard', () => {
  it('shows the label as a heading linking to the season, one status badge, the written range and the length', () => {
    renderCard(makeSeason())

    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('2026/27')
    expect(within(heading).getByRole('link')).toHaveAttribute('href', '/manage/fixtures/seasons/season-1')
    expect(chipLabels()).toEqual(['Current'])
    expect(screen.getByTestId('season-dates')).toHaveTextContent('1 Sep 2026 to 31 Mar 2027 · 7 months')
  })

  it.each([
    ['upcoming', { startDate: '2026-11-01' }, 'Upcoming'],
    ['past', { startDate: '2025-09-01', endDate: '2026-03-31' }, 'Past'],
    ['inactive', { active: false }, 'Inactive'],
  ])('shows only the %s badge', (_name, overrides, label) => {
    renderCard(makeSeason(overrides))
    expect(chipLabels()).toEqual([label])
  })

  it('reads "Ends in" with a Day n of m bar for the current season', () => {
    renderCard(makeSeason({ startDate: '2026-10-01', endDate: '2026-11-20' }))

    const strip = screen.getByTestId('season-time-strip')
    expect(strip).toHaveTextContent(/Ends in\s*41 days/)
    expect(strip).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByTestId('season-progress')).toHaveTextContent('Day 10 of 51')
    expect(screen.getByRole('progressbar', { name: 'Season progress' })).toHaveAttribute('aria-valuenow', '10')
  })

  it('turns the strip amber within 7 days of the end', () => {
    renderCard(makeSeason({ endDate: '2026-10-15' }))
    expect(screen.getByTestId('season-time-strip')).toHaveAttribute('data-tone', 'warning')
  })

  it('reads "Starts in" for an upcoming season and "Ended ... ago" for a past one, with a muted dash instead of a bar', () => {
    const { unmount } = renderCard(makeSeason({ startDate: '2026-10-22' }))
    expect(screen.getByTestId('season-time-strip')).toHaveTextContent(/Starts in\s*12 days/)
    expect(screen.getByTestId('season-progress')).toHaveTextContent('Progress-')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    unmount()

    renderCard(makeSeason({ startDate: '2025-09-01', endDate: '2026-07-10' }))
    expect(screen.getByTestId('season-time-strip')).toHaveTextContent(/Ended\s*3 months ago/)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows the three figures from the summary, zero included', () => {
    const { unmount } = renderCard(makeSeason())
    expect(screen.getByTestId('season-leagues')).toHaveTextContent('2Leagues')
    expect(screen.getByTestId('season-teams')).toHaveTextContent('5Teams')
    expect(screen.getByTestId('season-matches')).toHaveTextContent('48Matches')
    unmount()

    renderCard(makeSeason(), { seasonId: 'season-1', leagueCount: 0, teamsEntered: 0, matchCount: 0 })
    expect(screen.getByTestId('season-leagues')).toHaveTextContent('0Leagues')
  })

  it('shows a dash for each figure while the summary is not available', () => {
    renderCard(makeSeason(), null)
    expect(screen.getByTestId('season-leagues')).toHaveTextContent('-Leagues')
    expect(screen.getByTestId('season-teams')).toHaveTextContent('-Teams')
    expect(screen.getByTestId('season-matches')).toHaveTextContent('-Matches')
  })

  it('has the same parts for every status', () => {
    for (const overrides of [{}, { startDate: '2026-11-01' }, { startDate: '2025-09-01', endDate: '2026-03-31' }, { active: false }]) {
      const { unmount } = renderCard(makeSeason(overrides))
      for (const id of ['season-dates', 'season-time-strip', 'season-progress', 'season-leagues', 'season-teams', 'season-matches']) {
        expect(screen.getByTestId(id)).toBeInTheDocument()
      }
      unmount()
    }
  })

  it('has Matches, Leagues and Edit in the footer', async () => {
    const user = userEvent.setup()
    renderCard(makeSeason())

    expect(screen.getByRole('button', { name: 'Matches' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leagues' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/manage/fixtures/seasons/season-1/edit')
  })

  it('goes to the Leagues and Matches lists from the footer', async () => {
    const user = userEvent.setup()
    const { unmount } = renderCard(makeSeason())
    await user.click(screen.getByRole('button', { name: 'Leagues' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/manage/fixtures/leagues')
    unmount()

    renderCard(makeSeason())
    await user.click(screen.getByRole('button', { name: 'Matches' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/manage/fixtures/matches')
  })
})
