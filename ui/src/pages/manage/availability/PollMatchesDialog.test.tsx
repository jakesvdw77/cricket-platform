import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PollMatchesDialog } from './PollMatchesDialog'
import type { PollItem } from './pollItem'
import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { SectionAvailabilityRound, SectionAvailabilityRoundMatch } from '../../../api/sectionAvailabilityApi'

const getRoundMatches = vi.fn()

vi.mock('../../../api/sectionAvailabilityApi', async () => {
  const actual = await vi.importActual<typeof import('../../../api/sectionAvailabilityApi')>('../../../api/sectionAvailabilityApi')
  return { ...actual, getRoundMatches: (clubId: string, roundId: string) => getRoundMatches(clubId, roundId) }
})

const poll: OpenAvailabilityPoll = {
  pollId: 'poll-1',
  matchId: 'match-1',
  teamId: 'team-away',
  homeTeamId: 'team-home',
  homeTeamName: null,
  awayTeamId: 'team-away',
  awayTeamName: null,
  matchDate: '2030-06-01T09:00:00Z',
  venue: null,
  autoClose: true,
  scheduledCloseAt: null,
  canReopen: true,
  availableCount: 0,
  unavailableCount: 0,
  unsureCount: 0,
  noResponseCount: 0,
  availableRespondents: [],
  unavailableRespondents: [],
  unsureRespondents: [],
}

const round: SectionAvailabilityRound = {
  id: 'round-1',
  sectionId: 's1',
  sectionName: 'U13',
  description: 'Weekend',
  firstMatchDate: '2030-06-01',
  lastMatchDate: '2030-06-01',
  firstMatchKickoff: '2030-06-01T09:00:00Z',
  autoClose: true,
  scheduledCloseAt: null,
  canReopen: true,
  open: true,
  brackets: [
    { dayPart: 'MORNING', windowDate: '2030-06-01', windowId: 'w1', availableCount: 0, unavailableCount: 0, unsureCount: 0, noResponseCount: 0, coveredMatchCount: 1 },
    { dayPart: 'AFTERNOON', windowDate: '2030-06-01', windowId: 'w2', availableCount: 0, unavailableCount: 0, unsureCount: 0, noResponseCount: 0, coveredMatchCount: 0 },
  ],
}

function match(overrides: Partial<SectionAvailabilityRoundMatch> = {}): SectionAvailabilityRoundMatch {
  return {
    matchId: 'm1',
    teamId: 't1',
    teamName: 'U13 A',
    opponentLabel: 'Rivals CC',
    matchDate: '2030-06-01T09:00:00Z',
    venue: null,
    leagueName: 'Junior League',
    dayPart: 'MORNING',
    windowId: 'w1',
    ...overrides,
  }
}

function renderDialog(item: PollItem) {
  const onClose = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PollMatchesDialog open onClose={onClose} clubId="club-1" item={item} teamsById={new Map()} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PollMatchesDialog', () => {
  it('lists a group poll\'s matches under their slot, with an empty note for a slot without any', async () => {
    getRoundMatches.mockResolvedValue([match()])
    renderDialog({ kind: 'GROUP', round })

    expect(await screen.findByText('U13 A vs Rivals CC')).toBeInTheDocument()
    expect(screen.getByText(/Junior League/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /· Morning$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /· Afternoon$/ })).toBeInTheDocument()
    expect(screen.getByText('No matches in this slot.')).toBeInTheDocument()
    expect(getRoundMatches).toHaveBeenCalledWith('club-1', 'round-1')
  })

  it('links each group match to its match page and closes the dialog on navigation', async () => {
    getRoundMatches.mockResolvedValue([match({ matchId: 'm9' })])
    const user = userEvent.setup()
    const { onClose } = renderDialog({ kind: 'GROUP', round })

    const link = await screen.findByRole('link', { name: 'U13 A vs Rivals CC' })
    expect(link).toHaveAttribute('href', '/manage/fixtures/matches/m9')
    expect(link).not.toHaveAttribute('target')
    await user.click(link)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error when the matches cannot be loaded', async () => {
    getRoundMatches.mockRejectedValue(new Error('boom'))
    renderDialog({ kind: 'GROUP', round })
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this poll's matches")
  })

  it('shows a squad poll\'s single match as a link to the match view page', async () => {
    renderDialog({ kind: 'SQUAD', poll })

    expect(screen.getByText(/Venue TBC/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Unknown team vs Unknown team' })).toHaveAttribute(
      'href',
      '/manage/fixtures/matches/match-1',
    )
    expect(getRoundMatches).not.toHaveBeenCalled()
  })

  it('closes from its Done button', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({ kind: 'SQUAD', poll })
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })
})
