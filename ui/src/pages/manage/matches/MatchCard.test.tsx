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

  it('renders the badges above the heading in DOM order, leaving the title unconstrained', () => {
    renderCard(makeMatch({ polls: [squadPoll({ open: false })] }))

    const heading = screen.getByRole('heading', { name: '1st XI vs Riverside Occasionals' })
    const row = screen.getByTestId('badges-above')
    expect(getComputedStyle(row).justifyContent).toBe('flex-end')
    expect(within(row).getByText('Not announced')).toBeInTheDocument()
    expect(within(row).getByText('Poll closed')).toBeInTheDocument()
    expect(row.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // the header (avatar + title) holds no badge chips
    expect(heading.parentElement?.parentElement?.querySelector('.MuiChip-root')).toBeNull()
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

  describe('stacked details', () => {
    it('shows When, Venue and League with their values', () => {
      const match = makeMatch({ leagueId: 'league-1' })
      renderCard(match, { withLeague: true })

      expect(screen.getByText('When')).toBeInTheDocument()
      expect(screen.getByText(formatMatchDateTime(match.matchDate))).toBeInTheDocument()
      expect(screen.getByText('Venue')).toBeInTheDocument()
      expect(screen.getByText('Riverside Oval')).toBeInTheDocument()
      expect(screen.getByText('League')).toBeInTheDocument()
      expect(screen.getByText('Premier League · 2026/27')).toBeInTheDocument()
    })

    it('omits Venue when empty', () => {
      renderCard(makeMatch({ venue: null }))

      expect(screen.queryByText('Venue')).not.toBeInTheDocument()
      expect(screen.getByText('When')).toBeInTheDocument()
    })

    it('shows only the season when there is no league, and omits the line when neither resolves', () => {
      const { unmount } = renderCard(makeMatch())
      expect(screen.getByText('2026/27')).toBeInTheDocument()
      unmount()

      renderCard(makeMatch(), { withSeason: false })
      expect(screen.queryByText('League')).not.toBeInTheDocument()
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

  describe('footer', () => {
    it('renders Edit, Select, Poll, Share buttons in that order', () => {
      renderCard(makeMatch())

      const footer = screen.getByRole('button', { name: 'Edit' }).parentElement as HTMLElement
      const names = within(footer)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
      expect(names).toEqual(['Edit', 'Select', 'Poll', 'Share'])
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

    it('Poll opens the prefilled New poll flow when there is no poll', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch())

      await user.click(screen.getByRole('button', { name: 'Poll' }))

      expect(
        await screen.findByText('At: /manage/availability/new?type=group&sectionId=sec-1&matchId=match-1'),
      ).toBeInTheDocument()
    })

    it('Poll opens the squad Responses page for one squad poll', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ polls: [squadPoll({ pollId: 'poll-5' })] }))

      await user.click(screen.getByRole('button', { name: 'Poll' }))

      expect(await screen.findByText('At: /manage/availability/squad/match-1/poll-5')).toBeInTheDocument()
    })

    it('Poll opens the group Responses page for one group poll', async () => {
      const user = userEvent.setup()
      renderCard(makeMatch({ polls: [groupPoll({ roundId: 'round-9' })] }))

      await user.click(screen.getByRole('button', { name: 'Poll' }))

      expect(await screen.findByText('At: /manage/availability/group/round-9')).toBeInTheDocument()
    })

    it('Poll opens the match Availability tab for two polls', async () => {
      const user = userEvent.setup()
      renderCard(
        makeMatch({
          awayTeamId: 'team-2',
          awayTeamName: null,
          awayPickedCount: 0,
          polls: [squadPoll(), squadPoll({ pollId: 'poll-2', teamId: 'team-2' })],
        }),
      )

      await user.click(screen.getByRole('button', { name: 'Poll' }))

      expect(await screen.findByText(`At: ${EDIT}?tab=availability`)).toBeInTheDocument()
    })

    it('disables Select, Poll and Share with an explanatory title when neither side is a club team, keeping Edit enabled', () => {
      renderCard(makeMatch({ homeTeamId: null, homeTeamName: 'A', homePickedCount: null }))

      expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
      for (const name of ['Select', 'Poll', 'Share']) {
        const button = screen.getByRole('button', { name })
        expect(button).toBeDisabled()
        expect(button.closest('span[title]')).toHaveAttribute('title', 'None of your teams is playing in this match')
      }
    })

    it('treats another club\'s team (null picked count) plus a free-text side as no club team: disabled, with the note', () => {
      renderCard(makeMatch({ homeTeamId: 'other-club-team', homePickedCount: null }))

      for (const name of ['Select', 'Poll', 'Share']) {
        const button = screen.getByRole('button', { name })
        expect(button).toBeDisabled()
        expect(button.closest('span[title]')).toHaveAttribute('title', 'None of your teams is playing in this match')
      }
      expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
      expect(screen.getByText('Neither side is one of your teams, so there is nobody to pick.')).toBeInTheDocument()
    })

    it('enables Select, Poll and Share for a club side with zero picked', () => {
      renderCard(makeMatch({ homePickedCount: 0 }))

      for (const name of ['Select', 'Poll', 'Share']) {
        expect(screen.getByRole('button', { name })).toBeEnabled()
      }
    })

    it('enables Select, Poll and Share when a club team is playing', () => {
      renderCard(makeMatch())

      for (const name of ['Select', 'Poll', 'Share']) {
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
