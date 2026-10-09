import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LeagueFixturesTable } from './LeagueFixturesTable'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'

const teamsById = new Map<string, Team>([['t1', { id: 't1', name: 'Villagers 1', logoUrl: 'https://img.example/v.png' } as Team]])

function match(overrides: Partial<Match>): Match {
  return {
    id: 'm1',
    homeTeamId: null,
    homeTeamName: 'Hawks',
    homeTeamLogoUrl: null,
    awayTeamId: null,
    awayTeamName: 'Eagles',
    awayTeamLogoUrl: 'https://img.example/e.png',
    homeLeagueTeamId: null,
    awayLeagueTeamId: null,
    venue: 'Eagle Park',
    matchDate: '2099-06-01T14:30:00',
    ...overrides,
  } as Match
}

function renderTable(matches: Match[]) {
  return render(
    <MemoryRouter>
      <LeagueFixturesTable matches={matches} teamsById={teamsById} />
    </MemoryRouter>,
  )
}

describe('LeagueFixturesTable', () => {
  it('renders the header and a row per match with the when, the teams, the venue', () => {
    renderTable([match({}), match({ id: 'm2', venue: null })])

    expect(screen.getByRole('table', { name: 'Fixtures' })).toBeInTheDocument()
    for (const name of ['Match', 'When', 'Venue']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    const [first, second] = screen.getAllByTestId('fixture-row')
    expect(within(first).getByText('Hawks vs Eagles')).toBeInTheDocument()
    expect(within(first).getByTestId('fixture-row-when')).toHaveTextContent(/Jun/)
    expect(within(first).getByTestId('fixture-row-venue')).toHaveTextContent('Eagle Park')
    expect(within(second).getByTestId('fixture-row-venue')).toHaveTextContent('–')
  })

  it('shows a logo beside each team where there is one, and initials otherwise', () => {
    renderTable([match({ homeTeamId: 't1', homeTeamName: null })])

    const row = screen.getByTestId('fixture-row')
    expect(row.querySelectorAll('img')).toHaveLength(2)
    expect(row.querySelector('img[src="https://img.example/v.png"]')).not.toBeNull()
    expect(row.querySelector('img[src="https://img.example/e.png"]')).not.toBeNull()
  })

  it('links only our matches, to the match, with an Our match chip', () => {
    renderTable([match({ id: 'ours', homeTeamId: 't1', homeTeamName: null }), match({ id: 'theirs' })])

    const [ours, theirs] = screen.getAllByTestId('fixture-row')
    expect(ours).toHaveAttribute('data-ours', 'true')
    expect(within(ours).getByRole('link', { name: 'Villagers 1 vs Eagles' })).toHaveAttribute('href', '/manage/fixtures/matches/ours')
    expect(within(ours).getByTestId('fixture-row-ours')).toHaveTextContent('Our match')
    expect(theirs).toHaveAttribute('data-ours', 'false')
    expect(within(theirs).queryByRole('link')).not.toBeInTheDocument()
  })

  it('keeps the desktop-only columns marked so a phone can drop them, and shows the phone line', () => {
    renderTable([match({})])

    const row = screen.getByTestId('fixture-row')
    for (const id of ['fixture-row-when', 'fixture-row-venue', 'fixture-row-ours']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
    expect(within(row).getByTestId('fixture-row-phone-when')).toHaveTextContent('Eagle Park')
  })
})
