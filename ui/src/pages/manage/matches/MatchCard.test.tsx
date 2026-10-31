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

const LIST = '/manage/fixtures/matches'
const RETURN = 'returnTo=%2Fmanage%2Ffixtures%2Fmatches&returnLabel=Matches'
const teams = makeTeams(makeTeam('team-1', '1st XI', 'sec-1'), makeTeam('team-2', '2nd XI', 'sec-2'))
const league = { id: 'league-1', name: 'Premier League' } as League
const season = { id: 'season-1', label: '2026/27' } as Season

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname + location.search}</div>
}

function renderCard(match: Match, props: { viewTo?: string; withLeague?: boolean; withSeason?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[LIST]}>
        <Routes>
          <Route
            path={LIST}
            element={
              <MatchCard
                clubId="club-1"
                match={match}
                teamsById={teams}
                leaguesById={new Map(props.withLeague ? [[league.id, league]] : [])}
                seasonsById={new Map(props.withSeason === false ? [] : [[season.id, season]])}
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
      `/manage/fixtures/matches/match-1?${RETURN}`,
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

    // docs/specs/099-fields-directory.md: the Venue line carries the field's flag.
    it('flags an unverified field with a small Unverified field badge beside the venue', () => {
      renderCard(makeMatch({ playingAreaId: 'field-1', playingAreaName: 'Riverside Oval', playingAreaVerificationStatus: 'UNVERIFIED' }))

      expect(screen.getByText('Riverside Oval')).toBeInTheDocument()
      expect(screen.getByTestId('match-field-flag')).toHaveTextContent('Unverified field')
    })

    it('flags a rejected field with Field rejected', () => {
      renderCard(makeMatch({ playingAreaId: 'field-1', playingAreaVerificationStatus: 'REJECTED' }))

      expect(screen.getByTestId('match-field-flag')).toHaveTextContent('Field rejected')
    })

    it('shows no flag for a verified field or for a match with only the old venue text', () => {
      const { unmount } = renderCard(makeMatch({ playingAreaId: 'field-1', playingAreaVerificationStatus: 'VERIFIED' }))
      expect(screen.queryByTestId('match-field-flag')).not.toBeInTheDocument()
      unmount()

      renderCard(makeMatch({ playingAreaId: null, playingAreaVerificationStatus: null }))
      expect(screen.getByText('Riverside Oval')).toBeInTheDocument()
      expect(screen.queryByTestId('match-field-flag')).not.toBeInTheDocument()
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
      renderCard(makeMatch({ matchDate: inHours(-48), resultStatus: 'PUBLISHED' }))

      const strip = screen.getByTestId('match-time-strip')
      expect(strip).toHaveAttribute('data-tone', 'neutral')
      expect(within(strip).getByText('Played')).toBeInTheDocument()
      expect(within(strip).queryByText('Starts')).not.toBeInTheDocument()
      expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    })
  })

  // docs/specs/100-match-results-core.md, Match integration: the card reads the real result state, not the date.
  describe('result state (docs/specs/100)', () => {
    const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000 + 30_000).toISOString()

    it('shows no result badge when the match has none, and a draft or published match shows its badge', () => {
      const { unmount } = renderCard(makeMatch({ resultStatus: 'NONE' }))
      expect(screen.queryByText('Completed')).not.toBeInTheDocument()
      expect(screen.queryByText('Result draft')).not.toBeInTheDocument()
      unmount()
      const draft = renderCard(makeMatch({ resultStatus: 'DRAFT' }))
      expect(screen.getByText('Result draft')).toBeInTheDocument()
      draft.unmount()
      renderCard(makeMatch({ resultStatus: 'PUBLISHED', matchDate: inHours(-48) }))
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('says Awaiting result, not Played, for a started match without a published result', () => {
      renderCard(makeMatch({ matchDate: inHours(-48), resultStatus: 'DRAFT' }))

      const strip = screen.getByTestId('match-time-strip')
      expect(within(strip).getByText('Awaiting result')).toBeInTheDocument()
      expect(within(strip).queryByText('Played')).not.toBeInTheDocument()
      expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    })

    it('says Played for a published result and no countdown, even when the kickoff is still ahead', () => {
      renderCard(makeMatch({ matchDate: inHours(72), resultStatus: 'PUBLISHED' }))

      const strip = screen.getByTestId('match-time-strip')
      expect(within(strip).getByText('Played')).toBeInTheDocument()
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

  // docs/specs/130 and page-anatomy section 6: flat card, no footer bar or icon cluster, ONE Actions kebab.
  describe('actions kebab (docs/specs/130)', () => {
    const KEBAB = 'Actions for 1st XI v Riverside Occasionals'
    const past = () => new Date(Date.now() - 48 * 3_600_000).toISOString()
    const future = () => new Date(Date.now() + 48 * 3_600_000).toISOString()
    const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: KEBAB }))
      return screen.findByRole('menu', { name: KEBAB })
    }
    const titles = (menu: HTMLElement) => within(menu).getAllByRole('menuitem').map((item) => item.querySelector('span')?.textContent)

    it('is a flat card with no footer bar, no icon cluster and exactly one button', () => {
      renderCard(makeMatch({ scoringUrl: 'https://s.example/1', streamingUrl: 'https://t.example/2', deletable: true }))

      expect(screen.getAllByRole('button')).toHaveLength(1)
      expect(screen.queryByRole('link', { name: 'Scoring' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
      expect(window.getComputedStyle(screen.getByRole('heading', { name: '1st XI vs Riverside Occasionals' }).closest('.MuiCard-root') as HTMLElement).boxShadow).toBe('none')
    })

    it('lists the items in order for a match that has not started, with Share Team Sheet last', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ matchDate: future() }))

      expect(titles(await openMenu(user))).toEqual(['Open Match', 'Edit Match', 'Select Team', 'Open Availability', 'Capture Result', 'Share Team Sheet'])
    })

    it('adds Import Result after the result action once the match has started', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ matchDate: past() }))

      expect(titles(await openMenu(user))).toEqual(['Open Match', 'Edit Match', 'Select Team', 'Open Availability', 'Capture Result', 'Import Result', 'Share Team Sheet'])
    })

    it('offers Continue Result for a draft and View Result (and no Import) for a published result', async () => {
      const user = userEvent.setup()
      const draft = renderCard(makeMatch({ matchDate: past(), resultStatus: 'DRAFT' }))
      expect(titles(await openMenu(user))).toEqual(expect.arrayContaining(['Continue Result', 'Import Result']))
      draft.unmount()

      renderCard(makeMatch({ matchDate: past(), resultStatus: 'PUBLISHED' }))
      const menu = await openMenu(user)
      expect(titles(menu)).toContain('View Result')
      expect(titles(menu)).not.toContain('Import Result')
    })

    it('has Scoring and Watch Live items only when the match has the links, opening them in a new tab', async () => {
      const user = userEvent.setup()
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      renderCard(makeMatch({ matchDate: future(), scoringUrl: 'https://s.example/1', streamingUrl: 'https://t.example/2' }))

      const menu = await openMenu(user)
      expect(titles(menu)).toEqual(expect.arrayContaining(['Scoring', 'Watch Live']))
      await user.click(within(menu).getByTestId('manage-item-scoring'))
      expect(open).toHaveBeenCalledWith('https://s.example/1', '_blank', 'noopener,noreferrer')
      open.mockRestore()
    })

    it('has no Scoring or Watch Live item without the links, and no Deactivate or Delete item', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ deletable: true }))

      const menu = await openMenu(user)
      for (const name of ['Scoring', 'Watch Live', 'Deactivate', 'Reactivate', 'Delete']) {
        expect(titles(menu)).not.toContain(name)
      }
    })

    it('every destination carries the list as its origin', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ matchDate: future() }))

      const menu = await openMenu(user)
      expect(within(menu).getByTestId('manage-item-open')).toHaveAttribute('href', `/manage/fixtures/matches/match-1?${RETURN}`)
      expect(within(menu).getByTestId('manage-item-edit')).toHaveAttribute('href', `/manage/fixtures/matches/match-1/edit?${RETURN}`)
      expect(within(menu).getByTestId('manage-item-select-team')).toHaveAttribute('href', `/manage/team-selection/matches/match-1/sides/home?${RETURN}`)
      expect(within(menu).getByTestId('manage-item-result')).toHaveAttribute('href', `/manage/results/match-1/capture?${RETURN}`)
    })

    it('Open Availability opens the prefilled New poll flow when there is no poll', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch())

      await user.click(within(await openMenu(user)).getByTestId('manage-item-availability'))

      expect(
        await screen.findByText(`At: /manage/availability/new?type=group&sectionId=sec-1&matchId=match-1&${RETURN}`),
      ).toBeInTheDocument()
    })

    it('Open Availability opens the squad or group Responses page for one poll', async () => {
      const user = userEvent.setup()
      const squad = renderCard(makeMatch({ polls: [squadPoll({ pollId: 'poll-5' })] }))
      await user.click(within(await openMenu(user)).getByTestId('manage-item-availability'))
      expect(await screen.findByText(`At: /manage/availability/squad/match-1/poll-5?${RETURN}`)).toBeInTheDocument()
      squad.unmount()

      renderCard(makeMatch({ polls: [groupPoll({ roundId: 'round-9' })] }))
      await user.click(within(await openMenu(user)).getByTestId('manage-item-availability'))
      expect(await screen.findByText(`At: /manage/availability/group/round-9?${RETURN}`)).toBeInTheDocument()
    })

    it('lists one named Open Availability item per poll for a derby with two polls', async () => {
      const user = userEvent.setup()
      renderCard(
        makeMatch({
          awayTeamId: 'team-2',
          awayTeamName: null,
          awayPickedCount: 0,
          polls: [squadPoll(), squadPoll({ pollId: 'poll-2', teamId: 'team-2' })],
        }),
      )

      await user.click(screen.getByRole('button', { name: 'Actions for 1st XI v 2nd XI' }))
      const menu = await screen.findByRole('menu')
      expect(titles(menu).filter((title) => title?.startsWith('Open Availability'))).toEqual([
        'Open Availability: 1st XI · Home poll',
        'Open Availability: 2nd XI · Away poll',
      ])
      await user.click(within(menu).getByTestId('manage-item-availability-1'))
      expect(await screen.findByText(`At: /manage/availability/squad/match-1/poll-2?${RETURN}`)).toBeInTheDocument()
    })

    it('disables Select Team, Open Availability and Share Team Sheet with the reason when neither side is a club team, keeping Edit Match', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ homeTeamId: null, homeTeamName: 'A', homePickedCount: null }))

      const menu = await user.click(screen.getByRole('button', { name: 'Actions for A v Riverside Occasionals' })).then(() => screen.findByRole('menu'))
      for (const id of ['select-team', 'availability', 'share-team-sheet']) {
        expect(within(menu).getByTestId(`manage-item-${id}`)).toHaveAttribute('aria-disabled', 'true')
      }
      expect(within(menu).getAllByText('None of your teams is playing in this match')).toHaveLength(3)
      expect(within(menu).getByTestId('manage-item-edit')).not.toHaveAttribute('aria-disabled', 'true')
    })

    it('enables the team items for a club side with zero picked', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ homePickedCount: 0 }))

      const menu = await openMenu(user)
      for (const id of ['select-team', 'availability', 'share-team-sheet']) {
        expect(within(menu).getByTestId(`manage-item-${id}`)).not.toHaveAttribute('aria-disabled', 'true')
      }
    })

    it('Share Team Sheet opens the dialog and fetches the sides and squads only then', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch())
      expect(listMatchSides).not.toHaveBeenCalled()

      await user.click(within(await openMenu(user)).getByTestId('manage-item-share-team-sheet'))

      expect(await screen.findByText('Communicate Team Sheet')).toBeInTheDocument()
      expect(listMatchSides).toHaveBeenCalledWith('club-1', 'match-1')
      expect(listSquad).toHaveBeenCalledWith('club-1', 'team-1', 'season-1')
    })

    it('never follows the card link when the kebab is pressed', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch(), { viewTo: '/manage/fixtures/matches/match-1' })

      await openMenu(user)
      expect(screen.queryByText(/^At:/)).not.toBeInTheDocument()
    })
  })
})
