import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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

function renderTable(matches: Match[], entry = '/', originLabel?: string, onShare?: (match: Match) => void) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LeagueFixturesTable matches={matches} teamsById={teamsById} originLabel={originLabel} onShare={onShare} />
    </MemoryRouter>,
  )
}

// docs/specs/127-return-navigation.md: the origin and label carried in an href.
function returnOf(href: string | null) {
  const params = new URLSearchParams((href ?? '').split('?')[1])
  return { to: params.get('returnTo'), label: params.get('returnLabel') }
}

describe('LeagueFixturesTable', () => {
  it('renders the header and a row per match with the when, the teams, the venue', () => {
    renderTable([match({}), match({ id: 'm2', venue: null })])

    expect(screen.getByRole('table', { name: 'Fixtures' })).toBeInTheDocument()
    for (const name of ['When', 'Home', 'Away', 'Venue']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    const [first, second] = screen.getAllByTestId('fixture-row')
    expect(within(first).getByTestId('fixture-row-home')).toHaveTextContent('Hawks')
    expect(within(first).getByTestId('fixture-row-away')).toHaveTextContent('Eagles')
    expect(within(first).getByTestId('fixture-row-when')).toHaveTextContent(/Jun/)
    expect(within(first).getByTestId('fixture-row-venue')).toHaveTextContent('Eagle Park')
    expect(within(second).getByTestId('fixture-row-venue')).toHaveTextContent('–')
  })

  it('shows a logo beside each team where there is one, and initials otherwise', () => {
    renderTable([match({ homeTeamId: 't1', homeTeamName: null })])

    const row = screen.getByTestId('fixture-row')
    expect(row.querySelectorAll('img')).toHaveLength(4) // phone and desktop cells each draw both badges
    expect(row.querySelector('img[src="https://img.example/v.png"]')).not.toBeNull()
    expect(row.querySelector('img[src="https://img.example/e.png"]')).not.toBeNull()
  })

  it('links only our matches, to the match, with an Our match chip', () => {
    renderTable([match({ id: 'ours', homeTeamId: 't1', homeTeamName: null }), match({ id: 'theirs' })])

    const [ours, theirs] = screen.getAllByTestId('fixture-row')
    expect(ours).toHaveAttribute('data-ours', 'true')
    expect(within(ours).getByRole('link', { name: 'Villagers 1 vs Eagles' })).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/matches/ours'))
    expect(within(ours).getByTestId('fixture-row-ours')).toHaveTextContent('Our match')
    expect(theirs).toHaveAttribute('data-ours', 'false')
    expect(within(theirs).queryByRole('link')).not.toBeInTheDocument()
  })

  it('gives only our matches an Actions kebab: Open Match and Edit Match as links, then Share Match, disabled only without a handler', async () => {
    renderTable([match({ id: 'ours', homeTeamId: 't1', homeTeamName: null }), match({ id: 'theirs' })])

    const [ours, theirs] = screen.getAllByTestId('fixture-row')
    expect(within(theirs).queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument()
    await userEvent.click(within(ours).getByRole('button', { name: 'Actions for Villagers 1 vs Eagles' }))
    const items = screen.getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Open Match', 'Edit Match', expect.stringContaining('Share Match')])
    expect(items[0]).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/matches/ours'))
    expect(items[1]).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/matches/ours/edit'))
    expect(items[2]).toHaveAttribute('aria-disabled', 'true')
  })

  it('Share Match is enabled with a handler and calls it with the match', async () => {
    const onShare = vi.fn()
    renderTable([match({ id: 'ours', homeTeamId: 't1', homeTeamName: null })], '/', undefined, onShare)

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Villagers 1 vs Eagles' }))
    const item = screen.getByRole('menuitem', { name: /Share Match/ })
    expect(item).not.toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(item)
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 'ours' }))
  })

  it('keeps the desktop-only columns marked so a phone can drop them, and shows the phone line', () => {
    renderTable([match({})])

    const row = screen.getByTestId('fixture-row')
    for (const id of ['fixture-row-when', 'fixture-row-home', 'fixture-row-away', 'fixture-row-venue', 'fixture-row-ours']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
    expect(within(row).getByTestId('fixture-row-phone-when')).toHaveTextContent('Eagle Park')
    expect(within(row).getByTestId('fixture-row-phone-match')).toHaveTextContent('Hawksvs')
  })

  it('titles a team name so a truncated one can be read in full', () => {
    renderTable([match({ homeTeamName: 'The Very Long Named Cricket Club First XI' })])

    expect(within(screen.getByTestId('fixture-row-home')).getByTitle('The Very Long Named Cricket Club First XI')).toBeInTheDocument()
  })

  it('carries the page it is on (path and query) and its label as the origin of the match links', async () => {
    renderTable([match({ id: 'ours', homeTeamId: 't1', homeTeamName: null })], '/manage/fixtures/leagues/l-1/schedule?seasonId=s-9', 'TVL schedule')

    const [ours] = screen.getAllByTestId('fixture-row')
    const origin = { to: '/manage/fixtures/leagues/l-1/schedule?seasonId=s-9', label: 'TVL schedule' }
    expect(returnOf(within(ours).getByRole('link', { name: 'Villagers 1 vs Eagles' }).getAttribute('href'))).toEqual(origin)
    await userEvent.click(within(ours).getByRole('button', { name: 'Actions for Villagers 1 vs Eagles' }))
    for (const item of screen.getAllByRole('menuitem').filter((entry) => entry.hasAttribute('href'))) expect(returnOf(item.getAttribute('href'))).toEqual(origin)
  })

  it('has no open chevron on a row: the whole row is the link', () => {
    renderTable([match({ id: 'ours', homeTeamId: 't1', homeTeamName: null })])
    const [ours] = screen.getAllByTestId('fixture-row')
    expect(ours.querySelector('[data-testid="ChevronRightOutlinedIcon"]')).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Open' })).not.toBeInTheDocument()
    expect(within(ours).getByRole('link', { name: 'Villagers 1 vs Eagles' })).toBeInTheDocument()
  })
})
