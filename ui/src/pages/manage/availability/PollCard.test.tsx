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
import { legend } from '../../../test/legend'

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
  canReopen: true,
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
  canReopen: true,
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

const FOOTER = ['Close poll', 'Matches', 'Responses', 'Share invite']

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
    expect(screen.getByText(legend('Available 2'))).toBeInTheDocument()
    expect(screen.getByText('3 of 4 answered')).toBeInTheDocument()
    expect(screen.getByTestId('poll-1-bar-AVAILABLE')).toHaveStyle({ width: '50%' })
    expect(screen.getByTestId('poll-1-bar-NONE')).toHaveStyle({ width: '25%' })
    expect(screen.getByText('Poll closes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit close time' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit description' })).not.toBeInTheDocument()
  })

  it('clamps a long title to three lines rather than two', () => {
    renderCard({ kind: 'SQUAD', poll })

    expect(screen.getByRole('heading', { level: 3, name: 'Home Team vs Rivals CC' })).toHaveStyle({ WebkitLineClamp: '3' })
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
    expect(text.value).toContain('Availability: Home Team vs')
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
    await user.click(screen.getByRole('button', { name: 'Close poll' }))
    expect(closePoll).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Close poll' }))
    await waitFor(() => expect(closePoll).toHaveBeenCalledWith('club-1', 'match-1', 'poll-1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('a closed poll shows Closed, a Closed row and Reopen in the same footer slot, opening the Reopen dialog', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll }, false)

    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('Poll closed')).toBeInTheDocument()
    expect(footerNames()).toEqual(['Reopen poll', 'Matches', 'Responses', 'Share invite is unavailable: this poll is closed'])
    await user.click(screen.getByRole('button', { name: 'Reopen poll' }))
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
    expect(screen.getByText('Poll closes')).toBeInTheDocument()
    expect(screen.getByText('Manually')).toBeInTheDocument()
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

// docs/specs/073-availability-hub.md
describe('PollCard - whole-card click-through', () => {
  const squad: PollItem = { kind: 'SQUAD', poll }
  const group: PollItem = { kind: 'GROUP', round }

  it('the title is a stretched link to the squad poll Responses page, the heading kept', () => {
    renderCard(squad)
    const link = screen.getByRole('link', { name: 'Home Team vs Rivals CC' })
    expect(link).toHaveAttribute('href', '/manage/availability/squad/match-1/poll-1')
    expect(screen.getByRole('heading', { level: 3 })).toContainElement(link)
  })

  it('the title is a stretched link to the group poll Responses page', () => {
    renderCard(group)
    expect(screen.getByRole('link', { name: 'Weekend fixtures' })).toHaveAttribute('href', '/manage/availability/group/round-1')
  })

  it('clicking the title link opens the Responses page', async () => {
    renderCard(squad)
    await userEvent.setup().click(screen.getByRole('link', { name: 'Home Team vs Rivals CC' }))
    expect(await screen.findByText('At /manage/availability/squad/match-1/poll-1')).toBeInTheDocument()
  })

  it('the Responses button goes to the same place as the title link', async () => {
    renderCard(group)
    const href = screen.getByRole('link', { name: 'Weekend fixtures' }).getAttribute('href')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Responses' }))
    expect(await screen.findByText(`At ${href}`)).toBeInTheDocument()
  })

  it.each([
    ['Close poll', 'Close this poll?'],
    ['Edit description', 'Edit description'],
    ['Delete', 'Delete this group poll?'],
    ['Edit close time', 'Edit close time'],
  ])('%s runs only its own action and does not navigate', async (buttonName, dialogName) => {
    renderCard(group)

    await userEvent.setup().click(screen.getByRole('button', { name: buttonName }))

    expect(await screen.findByRole('dialog', { name: dialogName })).toBeInTheDocument()
    expect(screen.queryByText(/^At /)).not.toBeInTheDocument()
  })

  it('every interactive element that sits over the card link is positioned above it', () => {
    renderCard(group)
    for (const name of ['Edit description', 'Delete', 'Edit close time']) {
      expect(screen.getByRole('button', { name })).toHaveStyle({ position: 'relative' })
    }
  })
})

describe('PollCard - Poll closes line', () => {
  it('shows the label with the formatted date and time and the pencil inside the value while open', () => {
    renderCard({ kind: 'SQUAD', poll })

    const label = screen.getByText('Poll closes')
    const row = screen.getByTestId('poll-closes-row')
    expect(row).toHaveTextContent(new Date(poll.scheduledCloseAt as string).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))
    // The row has the calendar-cross icon and shares one strip with its label, value and pencil.
    expect(row.querySelector('[data-testid="EventBusyOutlinedIcon"]')).toBeInTheDocument()
    expect(row).toContainElement(label)
    expect(row).toContainElement(screen.getByRole('button', { name: 'Edit close time' }))
  })

  it('reads Manually with the pencil when an open poll has Autoclose off', () => {
    renderCard({ kind: 'GROUP', round })

    expect(screen.getByText('Manually')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit close time' })).toBeInTheDocument()
  })

  it('reads Poll closed with the date only and no pencil once closed', () => {
    renderCard({ kind: 'SQUAD', poll }, false)

    expect(screen.getByText('Poll closed')).toBeInTheDocument()
    expect(screen.queryByText('Poll closes')).not.toBeInTheDocument()
    const date = new Date(poll.scheduledCloseAt as string).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    expect(screen.getByText(date)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit close time' })).not.toBeInTheDocument()
  })

  it('reads Poll closed, Manually for a closed poll without Autoclose', () => {
    renderCard({ kind: 'GROUP', round: { ...round, open: false } })

    expect(screen.getByText('Poll closed')).toBeInTheDocument()
    expect(screen.getByText('Manually')).toBeInTheDocument()
  })

  it('the close-time pencil opens the close time dialog', async () => {
    renderCard({ kind: 'SQUAD', poll })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit close time' }))
    expect(await screen.findByRole('dialog', { name: 'Edit close time' })).toBeInTheDocument()
  })
})

// docs/specs/082-poll-card-improvements.md
describe('PollCard - spec 082', () => {
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000 + 30_000).toISOString()

  it('puts the close row before the response indicator', () => {
    renderCard({ kind: 'SQUAD', poll })
    const row = screen.getByTestId('poll-closes-row')
    const indicator = screen.getByTestId('poll-1-bar-AVAILABLE')
    expect(row.compareDocumentPosition(indicator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(row).getByText('Poll closes')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Edit close time' })).toBeInTheDocument()
  })

  it('is amber with a countdown within 24 hours of closing', () => {
    renderCard({ kind: 'SQUAD', poll: { ...poll, scheduledCloseAt: inHours(5) } })
    expect(screen.getByTestId('poll-closes-row')).toHaveAttribute('data-tone', 'warning')
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent(/^5 h \d+ min left$/)
    expect(timer).toHaveAttribute('data-warn', 'true')
  })

  it('is neutral with a countdown while the close time is more than a day away', () => {
    renderCard({ kind: 'SQUAD', poll: { ...poll, scheduledCloseAt: inHours(72) } })
    expect(screen.getByTestId('poll-closes-row')).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByRole('timer')).toHaveTextContent(/^3 days/)
  })

  it('has no countdown for a poll without a close time', () => {
    renderCard({ kind: 'GROUP', round })
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByTestId('poll-closes-row')).toHaveAttribute('data-tone', 'neutral')
  })

  it('has no countdown and stays neutral on a closed poll, even with a close time inside 24 hours', () => {
    renderCard({ kind: 'SQUAD', poll: { ...poll, scheduledCloseAt: inHours(5) } }, false)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByTestId('poll-closes-row')).toHaveAttribute('data-tone', 'neutral')
  })

  it('disables Reopen poll with its reason when the matches are in the past', async () => {
    renderCard({ kind: 'SQUAD', poll: { ...poll, canReopen: false } }, false)
    const reopen = screen.getByRole('button', { name: 'The matches in this poll are in the past' })
    expect(reopen).toBeDisabled()
    expect(reopen.parentElement).toHaveAttribute('title', 'The matches in this poll are in the past')
    await userEvent.setup({ pointerEventsCheck: 0 }).click(reopen)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables Reopen poll on a closed group poll that cannot be reopened', () => {
    renderCard({ kind: 'GROUP', round: { ...round, open: false, canReopen: false } })
    expect(screen.getByRole('button', { name: 'The matches in this poll are in the past' })).toBeDisabled()
  })

  it('enables Reopen poll when canReopen is true', () => {
    renderCard({ kind: 'GROUP', round: { ...round, open: false, canReopen: true } })
    expect(screen.getByRole('button', { name: 'Reopen poll' })).toBeEnabled()
  })

  it('draws the brand availability icon tile instead of an avatar', () => {
    renderCard({ kind: 'SQUAD', poll })
    const tile = screen.getByTestId('brand-icon-tile')
    expect(tile).toHaveStyle({ width: '56px', height: '56px' })
    expect(document.querySelector('.MuiAvatar-root')).not.toBeInTheDocument()
  })
})
