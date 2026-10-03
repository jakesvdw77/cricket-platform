import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PollCard } from './PollCard'
import type { PollItem } from './pollItem'
import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { SectionAvailabilityRound } from '../../../api/sectionAvailabilityApi'
import type { Team } from '../../../api/teamApi'

const closePoll = vi.fn()
const closeRound = vi.fn()
const getRoundMatches = vi.fn()

vi.mock('../../../api/matchAvailabilityApi', () => ({
  closePoll: (...args: unknown[]) => closePoll(...args),
  deletePoll: vi.fn(),
  openPoll: vi.fn(),
  updatePollCloseTime: vi.fn(),
}))
vi.mock('../../../api/sectionAvailabilityApi', async () => {
  const actual = await vi.importActual<typeof import('../../../api/sectionAvailabilityApi')>('../../../api/sectionAvailabilityApi')
  return {
    ...actual,
    closeRound: (...args: unknown[]) => closeRound(...args),
    deleteRound: vi.fn(),
    openRound: vi.fn(),
    updateRoundCloseTime: vi.fn(),
    updateRoundDescription: vi.fn(),
    getRoundMatches: (...args: unknown[]) => getRoundMatches(...args),
  }
})

const poll: OpenAvailabilityPoll = {
  pollId: 'poll-1',
  matchId: 'match-1',
  teamId: 'team-home',
  homeTeamId: 'team-home',
  homeTeamName: null,
  awayTeamId: null,
  awayTeamName: 'Rivals CC',
  matchDate: '2030-06-01T09:00:00Z',
  venue: 'Home Ground',
  autoClose: true,
  scheduledCloseAt: '2030-05-31T09:00:00Z',
  availableCount: 2,
  unavailableCount: 1,
  unsureCount: 0,
  noResponseCount: 1,
  availableRespondents: [],
  unavailableRespondents: [],
  unsureRespondents: [],
}

const round: SectionAvailabilityRound = {
  id: 'round-1',
  sectionId: 's1',
  sectionName: 'U13 Boys',
  description: 'Weekend fixtures',
  firstMatchDate: '2030-06-01',
  lastMatchDate: '2030-06-02',
  firstMatchKickoff: '2030-06-01T09:00:00Z',
  autoClose: false,
  scheduledCloseAt: null,
  open: true,
  brackets: [
    { dayPart: 'MORNING', windowDate: '2030-06-01', windowId: 'w1', availableCount: 1, unavailableCount: 1, unsureCount: 0, noResponseCount: 2, coveredMatchCount: 2 },
    { dayPart: 'AFTERNOON', windowDate: '2030-06-02', windowId: 'w2', availableCount: 0, unavailableCount: 0, unsureCount: 0, noResponseCount: 4, coveredMatchCount: 1 },
  ],
}

const teamsById = new Map<string, Team>([['team-home', { id: 'team-home', name: 'Home Team' } as Team]])

function LocationProbe() {
  const location = useLocation()
  return <div>{`At ${location.pathname}${location.search}`}</div>
}

function renderCard(item: PollItem, open = true) {
  const onChanged = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route path="/start" element={<PollCard clubId="club-1" item={item} open={open} teamsById={teamsById} onChanged={onChanged} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onChanged }
}

const FOOTER = ['Close', 'Matches', 'Responses', 'Share invite']

function footerNames(): (string | null)[] {
  const footer = screen.getByRole('button', { name: 'Matches' }).parentElement as HTMLElement
  return within(footer).getAllByRole('button').map((button) => button.getAttribute('aria-label'))
}

beforeEach(() => {
  vi.clearAllMocks()
  closePoll.mockResolvedValue({})
  closeRound.mockResolvedValue({})
  getRoundMatches.mockResolvedValue([])
})

describe('PollCard - squad poll', () => {
  it('shows the header, the date and venue subtitle, one slot summary with bar widths and the Closes row', () => {
    renderCard({ kind: 'SQUAD', poll })

    expect(screen.getByRole('heading', { level: 3, name: 'Home Team vs Rivals CC' })).toBeInTheDocument()
    expect(screen.getByText('Squad poll')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText(/ · Home Ground$/)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(screen.getByText('Available 2')).toBeInTheDocument()
    expect(screen.getByText('3 of 4 answered')).toBeInTheDocument()
    expect(screen.getByTestId('poll-1-bar-AVAILABLE')).toHaveStyle({ width: '50%' })
    expect(screen.getByTestId('poll-1-bar-NONE')).toHaveStyle({ width: '25%' })
    expect(screen.getByText(/^Closes /)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit close time' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit description' })).not.toBeInTheDocument()
  })

  it('shows Venue TBC when there is no venue', () => {
    renderCard({ kind: 'SQUAD', poll: { ...poll, venue: null } })
    expect(screen.getByText(/ · Venue TBC$/)).toBeInTheDocument()
  })

  it('has the four footer buttons in the fixed order', () => {
    renderCard({ kind: 'SQUAD', poll })
    expect(footerNames()).toEqual(FOOTER)
  })

  it("Responses goes to the squad poll's own Responses page", async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll })
    await user.click(screen.getByRole('button', { name: 'Responses' }))
    expect(await screen.findByText('At /manage/availability/squad/match-1/poll-1')).toBeInTheDocument()
  })

  it('Share opens the invite dialog with the poll link and the side\'s team name', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll })
    await user.click(screen.getByRole('button', { name: 'Share invite' }))
    const text = (await screen.findByLabelText('Invite text')) as HTMLTextAreaElement
    expect(text.value).toContain('Hi Home Team!')
    expect(text.value).toContain('/poll/poll-1')
  })

  it('Share is disabled with an explanation on a closed squad poll and does nothing when clicked', async () => {
    renderCard({ kind: 'SQUAD', poll }, false)
    const share = screen.getByRole('button', { name: 'Share invite is unavailable: this poll is closed' })
    expect(share).toBeDisabled()
    expect(share.parentElement).toHaveAttribute('title', 'Share invite is unavailable: this poll is closed')
    expect(screen.queryByRole('button', { name: 'Share invite' })).not.toBeInTheDocument()
    await userEvent.setup({ pointerEventsCheck: 0 }).click(share)
    expect(screen.queryByLabelText('Invite text')).not.toBeInTheDocument()
  })

  it('Close confirms before calling closePoll, then reports the change', async () => {
    const user = userEvent.setup()
    const { onChanged } = renderCard({ kind: 'SQUAD', poll })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(closePoll).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Close poll' }))
    await waitFor(() => expect(closePoll).toHaveBeenCalledWith('club-1', 'match-1', 'poll-1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('a closed poll shows Closed, a Closed row and Reopen in the same footer slot, opening the Reopen dialog', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll }, false)

    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText(/^Closed .+/, { selector: 'p' })).toBeInTheDocument()
    expect(footerNames()).toEqual(['Reopen', 'Matches', 'Responses', 'Share invite is unavailable: this poll is closed'])
    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(await screen.findByRole('heading', { name: 'Reopen this poll' })).toBeInTheDocument()
  })
})

describe('PollCard - group poll', () => {
  it('shows the description title with a pencil, the section and match count, and one slot summary per bracket', () => {
    renderCard({ kind: 'GROUP', round })

    expect(screen.getByRole('heading', { level: 3, name: 'Weekend fixtures' })).toBeInTheDocument()
    expect(screen.getByText('Group poll')).toBeInTheDocument()
    expect(screen.queryByText('Home')).not.toBeInTheDocument()
    expect(screen.getByText('U13 Boys · 3 matches')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit description' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(2)
    expect(screen.getByTestId('w1-bar-AVAILABLE')).toHaveStyle({ width: '25%' })
    expect(screen.getByTestId('w2-bar-NONE')).toHaveStyle({ width: '100%' })
    expect(screen.getByText('Closes manually')).toBeInTheDocument()
  })

  it('has the identical four footer buttons in the same order as the squad card', () => {
    renderCard({ kind: 'GROUP', round })
    expect(footerNames()).toEqual(FOOTER)
  })

  it('Share is enabled on an open group poll and disabled with an explanation on a closed one', async () => {
    renderCard({ kind: 'GROUP', round: { ...round, open: false } })
    const share = screen.getByRole('button', { name: 'Share invite is unavailable: this poll is closed' })
    expect(share).toBeDisabled()
    expect(share.parentElement).toHaveAttribute('title', 'Share invite is unavailable: this poll is closed')
    await userEvent.setup({ pointerEventsCheck: 0 }).click(share)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Share opens the group invite dialog on an open group poll', async () => {
    renderCard({ kind: 'GROUP', round })
    const share = screen.getByRole('button', { name: 'Share invite' })
    expect(share).toBeEnabled()
    await userEvent.setup({ pointerEventsCheck: 0 }).click(share)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('Responses navigates to the group responses page', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round })
    await user.click(screen.getByRole('button', { name: 'Responses' }))
    expect(await screen.findByText('At /manage/availability/group/round-1')).toBeInTheDocument()
  })

  it('Matches opens the matches dialog', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round })
    await user.click(screen.getByRole('button', { name: 'Matches' }))
    expect(await screen.findByRole('dialog', { name: 'Matches' })).toBeInTheDocument()
    expect(getRoundMatches).toHaveBeenCalledWith('club-1', 'round-1')
  })

  it('the description pencil opens a dialog and no inline panel appears', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round })
    await user.click(screen.getByRole('button', { name: 'Edit description' }))
    expect(await screen.findByRole('dialog', { name: 'Edit description' })).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toHaveValue('Weekend fixtures')
  })
})
