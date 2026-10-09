import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchCard } from './MatchCard'
import { groupPoll, makeMatch, makeTeam, makeTeams, squadPoll } from './matchTestUtils'
import { formatMatchDateTime } from '../availability/pollHelpers'
import type { Match } from '../../../api/matchApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'

const listMatchSides = vi.fn()
const listSquad = vi.fn()

vi.mock('../../../api/matchSideApi', () => ({
  listMatchSides: (clubId: string, matchId: string) => listMatchSides(clubId, matchId),
}))

vi.mock('../../../api/teamSquadApi', () => ({
  listSquad: (clubId: string, teamId: string, seasonId: string) => listSquad(clubId, teamId, seasonId),
}))

const EDIT = '/manage/fixtures/matches/match-1/edit'
const teams = makeTeams(makeTeam('team-1', '1st XI', 'sec-1'), makeTeam('team-2', '2nd XI', 'sec-2'))
const league = { id: 'league-1', name: 'Premier League' } as League
const season = { id: 'season-1', label: '2026/27' } as Season

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname + location.search}</div>
}

function renderCard(match: Match, props: { viewTo?: string; editTo?: string; withLeague?: boolean; withSeason?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/list']}>
        <Routes>
          <Route
            path="/list"
            element={
              <MatchCard
                clubId="club-1"
                match={match}
                teamsById={teams}
                leaguesById={new Map(props.withLeague ? [[league.id, league]] : [])}
                seasonsById={new Map(props.withSeason === false ? [] : [[season.id, season]])}
                editTo={props.editTo ?? EDIT}
                viewTo={props.viewTo}
              />
            }
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listMatchSides.mockResolvedValue([])
  listSquad.mockResolvedValue([])
})

describe('MatchCard', () => {
  it('renders the Home vs Away title as a heading linking to the view route when viewTo is set', () => {
    renderCard(makeMatch(), { viewTo: '/manage/fixtures/matches/match-1' })

    expect(screen.getByRole('heading', { name: '1st XI vs Riverside Occasionals' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1st XI vs Riverside Occasionals' })).toHaveAttribute(
      'href',
      '/manage/fixtures/matches/match-1',
    )
  })

  it('renders no title link without viewTo', () => {
    renderCard(makeMatch())

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders the badges in a left-aligned row under the header, after the title (docs/specs/087)', () => {
    renderCard(makeMatch({ polls: [squadPoll({ open: false })] }))

    const heading = screen.getByRole('heading', { name: '1st XI vs Riverside Occasionals' })
    expect(screen.queryByTestId('badges-above')).not.toBeInTheDocument()
    const row = screen.getByText('Not announced').closest('.MuiChip-root')?.parentElement as HTMLElement
    expect(within(row).getByText('Poll closed')).toBeInTheDocument()
    expect(getComputedStyle(row).justifyContent).not.toBe('flex-end')
    expect(heading.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // the header (avatar + title) holds no badge chips
    expect(heading.parentElement?.parentElement?.querySelector('.MuiChip-root')).toBeNull()
  })

  it('uses the brand match icon on its tile as the avatar (docs/specs/087)', () => {
    renderCard(makeMatch())

    const tile = screen.getByTestId('brand-icon-tile')
    expect(tile.querySelector('img')?.getAttribute('src')).toContain('upcoming-matches')
  })

  describe('badges', () => {
    it('shows an unprefixed Not announced badge and No poll for a plain match', () => {
      renderCard(makeMatch())

      expect(screen.getByText('Not announced')).toBeInTheDocument()
      expect(screen.getByText('No poll')).toBeInTheDocument()
      expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
    })

    it('shows Announced when the side is announced', () => {
      renderCard(makeMatch({ homeSideAnnounced: true }))

      expect(screen.getByText('Announced')).toBeInTheDocument()
    })

    it('prefixes each side with its team name only when both sides are club teams', () => {
      renderCard(makeMatch({ awayTeamId: 'team-2', awayTeamName: null, awayPickedCount: 0, homeSideAnnounced: true }))

      expect(screen.getByText('1st XI: Announced')).toBeInTheDocument()
      expect(screen.getByText('2nd XI: Not announced')).toBeInTheDocument()
    })

    it('shows no announced badge when neither side is a club team', () => {
      renderCard(makeMatch({ homeTeamId: null, homeTeamName: 'A', homePickedCount: null }))

      expect(screen.queryByText(/announced/i)).not.toBeInTheDocument()
    })

    it('shows an Inactive badge for an inactive match', () => {
      renderCard(makeMatch({ active: false }))

      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('shows Poll open when the poll is open', () => {
      renderCard(makeMatch({ polls: [squadPoll({ open: true })] }))

      expect(screen.getByText('Poll open')).toBeInTheDocument()
    })

    it('shows Poll closed when there are polls and none is open', () => {
      renderCard(makeMatch({ polls: [squadPoll({ open: false })] }))

      expect(screen.getByText('Poll closed')).toBeInTheDocument()
    })

    it('shows Poll open when either of two polls is open', () => {
      renderCard(
        makeMatch({ polls: [squadPoll({ open: false }), squadPoll({ pollId: 'poll-2', teamId: 'team-2', open: true })] }),
      )

      expect(screen.getByText('Poll open')).toBeInTheDocument()
      expect(screen.queryByText('Poll closed')).not.toBeInTheDocument()
    })
  })

  describe('subtitle and venue (docs/specs/087)', () => {
    it('shows League · Season as the subtitle and Venue as the one detail line', () => {
      renderCard(makeMatch({ leagueId: 'league-1' }), { withLeague: true })

      expect(screen.getByText('Premier League · 2026/27')).toBeInTheDocument()
      expect(screen.getByText('Venue')).toBeInTheDocument()
      expect(screen.getByText('Riverside Oval')).toBeInTheDocument()
      // When and League no longer have their own lines: the date is in the strip, the league in the subtitle.
      expect(screen.queryByText('When')).not.toBeInTheDocument()
      expect(screen.queryByText('League')).not.toBeInTheDocument()
    })

    it('omits Venue when empty', () => {
      renderCard(makeMatch({ venue: null }))

      expect(screen.queryByText('Venue')).not.toBeInTheDocument()
    })

    it('shows only the season when there is no league, and no subtitle when neither resolves', () => {
      const { unmount } = renderCard(makeMatch())
      expect(screen.getByText('2026/27')).toBeInTheDocument()
      unmount()

      renderCard(makeMatch(), { withSeason: false })
      expect(screen.queryByText('2026/27')).not.toBeInTheDocument()
    })
  })

  describe('time strip (docs/specs/087)', () => {
    const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000 + 30_000).toISOString()

    it('reads Starts with the date and a neutral countdown while kickoff is more than a day away', () => {
      const match = makeMatch({ matchDate: inHours(72) })
      renderCard(match)

      const strip = screen.getByTestId('match-time-strip')
      expect(strip).toHaveAttribute('data-tone', 'neutral')
      expect(within(strip).getByText('Starts')).toBeInTheDocument()
      expect(within(strip).getByText(formatMatchDateTime(match.matchDate))).toBeInTheDocument()
      const timer = within(strip).getByRole('timer')
      expect(timer).toHaveTextContent(/^3 days.* to go$/)
      expect(timer).toHaveAttribute('data-warn', 'false')
    })

    it('is amber with a countdown within 24 hours of kickoff', () => {
      renderCard(makeMatch({ matchDate: inHours(5) }))

      const strip = screen.getByTestId('match-time-strip')
      expect(strip).toHaveAttribute('data-tone', 'warning')
      expect(within(strip).getByRole('timer')).toHaveTextContent(/^5 h \d+ min to go$/)
    })

    it('reads Played, neutral and with no countdown once the match has started', () => {
      renderCard(makeMatch({ matchDate: inHours(-48) }))

      const strip = screen.getByTestId('match-time-strip')
      expect(strip).toHaveAttribute('data-tone', 'neutral')
      expect(within(strip).getByText('Played')).toBeInTheDocument()
      expect(within(strip).queryByText('Starts')).not.toBeInTheDocument()
      expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    })
  })

  describe('selection block', () => {
    it('shows a row for the club side', () => {
      renderCard(makeMatch({ homePickedCount: 7 }))

      expect(screen.getByText('7 of 11 picked')).toBeInTheDocument()
    })

    it('shows the nobody-to-pick note when neither side is a club team', () => {
      renderCard(makeMatch({ homeTeamId: null, homeTeamName: 'A', homePickedCount: null }))

      expect(screen.getByText('Neither side is one of your teams, so there is nobody to pick.')).toBeInTheDocument()
    })

    it('shows two rows for a derby', () => {
      renderCard(makeMatch({ awayTeamId: 'team-2', awayTeamName: null, homePickedCount: 11, awayPickedCount: 2 }))

      expect(screen.getByText('squad complete')).toBeInTheDocument()
      expect(screen.getByText('2 of 11 picked')).toBeInTheDocument()
    })
  })

  describe('links row (docs/specs/075)', () => {
    it('renders no row and no extra divider when neither link is set', () => {
      renderCard(makeMatch())

      expect(screen.queryByTestId('match-links-row')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Scoring' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Watch live' })).not.toBeInTheDocument()
    })

    it('renders only the set icon, opening in a new tab with noopener', () => {
      renderCard(makeMatch({ scoringUrl: 'https://cricclubs.com/matches/1' }))

      const scoring = screen.getByRole('link', { name: 'Scoring' })
      expect(scoring).toHaveAttribute('href', 'https://cricclubs.com/matches/1')
      expect(scoring).toHaveAttribute('title', 'Scoring')
      expect(scoring).toHaveAttribute('target', '_blank')
      expect(scoring.getAttribute('rel')).toContain('noopener')
      expect(screen.queryByRole('link', { name: 'Watch live' })).not.toBeInTheDocument()
    })

    it('renders both icons and sits above the stretched title link', async () => {
      const user = userEvent.setup()
      renderCard(
        makeMatch({ scoringUrl: 'https://s.example/1', streamingUrl: 'https://t.example/2' }),
        { viewTo: '/manage/fixtures/matches/match-1' },
      )

      const row = screen.getByTestId('match-links-row')
      // the header wrapper (RecordCard headerActions) carries position: relative, above the stretched link
      expect(row.parentElement).toHaveStyle({ position: 'relative' })
      expect(within(row).getByRole('link', { name: 'Watch live' })).toHaveAttribute('href', 'https://t.example/2')
      expect(within(row).getByRole('link', { name: 'Scoring' })).toHaveAttribute('href', 'https://s.example/1')

      // clicking an icon never navigates the card (the link opens in a new tab)
      await user.click(within(row).getByRole('link', { name: 'Scoring' }))
      expect(screen.queryByText(/^At:/)).not.toBeInTheDocument()
    })
  })

  describe('footer', () => {
    it('renders Edit, Select, Availability, Share buttons in that order', () => {
      renderCard(makeMatch())

      const footer = screen.getByRole('button', { name: 'Edit' }).parentElement as HTMLElement
      const names = within(footer)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
      expect(names).toEqual(['Edit', 'Select', 'Availability', 'Share'])
    })

    it('Edit navigates to the edit route', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch())

      await user.click(screen.getByRole('button', { name: 'Edit' }))

      expect(await screen.findByText(`At: ${EDIT}`)).toBeInTheDocument()
    })

    it('Select navigates to the Playing XI tab, without duplicating an existing tab param', async () => {
      const user = userEvent.setup()
      const { unmount } = renderCard(makeMatch())
      await user.click(screen.getByRole('button', { name: 'Select' }))
      expect(await screen.findByText(`At: ${EDIT}?tab=playing-xi`)).toBeInTheDocument()
      unmount()

      renderCard(makeMatch(), { editTo: `${EDIT}?tab=playing-xi` })
      await user.click(screen.getByRole('button', { name: 'Select' }))
      expect(await screen.findByText(`At: ${EDIT}?tab=playing-xi`)).toBeInTheDocument()
    })

    it('Availability opens the prefilled New poll flow when there is no poll', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch())

      await user.click(screen.getByRole('button', { name: 'Availability' }))

      expect(
        await screen.findByText('At: /manage/availability/new?type=group&sectionId=sec-1&matchId=match-1'),
      ).toBeInTheDocument()
    })

    it('Availability opens the squad Responses page for one squad poll', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ polls: [squadPoll({ pollId: 'poll-5' })] }))

      await user.click(screen.getByRole('button', { name: 'Availability' }))

      expect(await screen.findByText('At: /manage/availability/squad/match-1/poll-5')).toBeInTheDocument()
    })

    it('Availability opens the group Responses page for one group poll', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ polls: [groupPoll({ roundId: 'round-9' })] }))

      await user.click(screen.getByRole('button', { name: 'Availability' }))

      expect(await screen.findByText('At: /manage/availability/group/round-9')).toBeInTheDocument()
    })

    it('Availability opens a menu for two polls and each option opens its Responses page', async () => {
      const user = userEvent.setup()
      const derby = makeMatch({
        awayTeamId: 'team-2',
        awayTeamName: null,
        awayPickedCount: 0,
        polls: [squadPoll(), squadPoll({ pollId: 'poll-2', teamId: 'team-2' })],
      })
      const { unmount } = renderCard(derby)

      await user.click(screen.getByRole('button', { name: 'Availability' }))
      const menu = await screen.findByRole('menu', { name: 'Availability polls' })
      expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        '1st XI · Home poll',
        '2nd XI · Away poll',
      ])
      await user.click(within(menu).getByRole('menuitem', { name: '2nd XI · Away poll' }))
      expect(await screen.findByText('At: /manage/availability/squad/match-1/poll-2')).toBeInTheDocument()
      unmount()

      renderCard(derby)
      await user.click(screen.getByRole('button', { name: 'Availability' }))
      await user.click(await screen.findByRole('menuitem', { name: '1st XI · Home poll' }))
      expect(await screen.findByText('At: /manage/availability/squad/match-1/poll-1')).toBeInTheDocument()
    })

    it('does not open a menu for one or no poll', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ polls: [squadPoll({ pollId: 'poll-5' })] }))
      await user.click(screen.getByRole('button', { name: 'Availability' }))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('disables Select, Availability and Share with an explanatory title when neither side is a club team, keeping Edit enabled', () => {
      renderCard(makeMatch({ homeTeamId: null, homeTeamName: 'A', homePickedCount: null }))

      expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
      for (const name of ['Select', 'Availability', 'Share']) {
        const button = screen.getByRole('button', { name })
        expect(button).toBeDisabled()
        expect(button.closest('span[title]')).toHaveAttribute('title', 'None of your teams is playing in this match')
      }
    })

    it('treats another club\'s team (null picked count) plus a free-text side as no club team: disabled, with the note', () => {
      renderCard(makeMatch({ homeTeamId: 'other-club-team', homePickedCount: null }))

      for (const name of ['Select', 'Availability', 'Share']) {
        const button = screen.getByRole('button', { name })
        expect(button).toBeDisabled()
        expect(button.closest('span[title]')).toHaveAttribute('title', 'None of your teams is playing in this match')
      }
      expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
      expect(screen.getByText('Neither side is one of your teams, so there is nobody to pick.')).toBeInTheDocument()
    })

    it('enables Select, Availability and Share for a club side with zero picked', () => {
      renderCard(makeMatch({ homePickedCount: 0 }))

      for (const name of ['Select', 'Availability', 'Share']) {
        expect(screen.getByRole('button', { name })).toBeEnabled()
      }
    })

    it('enables Select, Availability and Share when a club team is playing', () => {
      renderCard(makeMatch())

      for (const name of ['Select', 'Availability', 'Share']) {
        expect(screen.getByRole('button', { name })).toBeEnabled()
      }
    })

    it('Share opens the Team Sheet dialog and fetches the sides and squads only then', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch())
      expect(listMatchSides).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Share' }))

      expect(await screen.findByText('Communicate Team Sheet')).toBeInTheDocument()
      expect(listMatchSides).toHaveBeenCalledWith('club-1', 'match-1')
      expect(listSquad).toHaveBeenCalledWith('club-1', 'team-1', 'season-1')
    })
  })
})
