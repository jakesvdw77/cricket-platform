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

// docs/specs/136: no footer bar and no pencils; every action is in the card's one kebab.
const SQUAD_TITLE = 'Home Team vs Rivals CC'

async function openActions(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: `Actions for ${title}` }))
}

async function choose(user: ReturnType<typeof userEvent.setup>, title: string, itemName: string | RegExp) {
  await openActions(user, title)
  await user.click(await screen.findByRole('menuitem', { name: itemName }))
}

function menuItemNames(): string[] {
  return screen.getAllByRole('menuitem').map((item) => (item.textContent ?? '').trim())
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

    expect(screen.getByRole('heading', { level: 3, name: SQUAD_TITLE })).toBeInTheDocument()
    expect(screen.getByText('Squad Poll')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText(/ · Home Ground$/)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(screen.getByText(legend('Available 2'))).toBeInTheDocument()
    expect(screen.getByText('3 of 4 answered')).toBeInTheDocument()
    expect(screen.getByTestId('poll-1-bar-AVAILABLE')).toHaveStyle({ width: '50%' })
    expect(screen.getByTestId('poll-1-bar-NONE')).toHaveStyle({ width: '25%' })
    expect(screen.getByText('Poll closes')).toBeInTheDocument()
  })

  it('clamps a long title to three lines rather than two', () => {
    renderCard({ kind: 'SQUAD', poll })

    expect(screen.getByRole('heading', { level: 3, name: SQUAD_TITLE })).toHaveStyle({ WebkitLineClamp: '3' })
  })

  it('shows Venue TBC when there is no venue', () => {
    renderCard({ kind: 'SQUAD', poll: { ...poll, venue: null } })
    expect(screen.getByText(/ · Venue TBC$/)).toBeInTheDocument()
  })

  it('has no footer bar, no pencil and no corner Delete: one kebab holds every action', () => {
    renderCard({ kind: 'SQUAD', poll })
    expect(screen.getByRole('button', { name: `Actions for ${SQUAD_TITLE}` })).toBeInTheDocument()
    for (const name of ['Close poll', 'Matches', 'Responses', 'Share invite', 'Edit close time', 'Delete']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('the kebab lists the squad poll actions in order, Share Invite last', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll })
    await openActions(user, SQUAD_TITLE)
    expect(menuItemNames()).toEqual(['Open Responses', 'Edit Close Time', 'Matches Covered', 'Close Poll', 'Delete Poll', 'Share Invite'])
  })

  it("Open Responses goes to the squad poll's own Responses page", async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll })
    await choose(user, SQUAD_TITLE, 'Open Responses')
    expect(await screen.findByText(/^At \/manage\/availability\/squad\/match-1\/poll-1/)).toBeInTheDocument()
  })

  it("Share Invite opens the invite dialog with the poll link and the side's team name", async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll })
    await choose(user, SQUAD_TITLE, 'Share Invite')
    const text = (await screen.findByLabelText('Message text')) as HTMLTextAreaElement
    expect(text.value).toContain('Availability: Home Team vs')
    expect(text.value).toContain('/poll/poll-1')
  })

  it('Share Invite is disabled with its reason on a closed squad poll', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll }, false)
    await openActions(user, SQUAD_TITLE)
    const share = screen.getByRole('menuitem', { name: /Share Invite/ })
    expect(share).toHaveAttribute('aria-disabled', 'true')
    expect(share).toHaveTextContent('Share invite is unavailable: this poll is closed')
  })

  it('Close Poll confirms before calling closePoll, then reports the change', async () => {
    const user = userEvent.setup()
    const { onChanged } = renderCard({ kind: 'SQUAD', poll })
    await choose(user, SQUAD_TITLE, 'Close Poll')
    expect(closePoll).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Close poll' }))
    await waitFor(() => expect(closePoll).toHaveBeenCalledWith('club-1', 'match-1', 'poll-1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('a closed poll shows Closed and a Closed row, and the kebab offers Reopen Poll instead of Close Poll, opening the Reopen dialog', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll }, false)

    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('Poll closed')).toBeInTheDocument()
    await openActions(user, SQUAD_TITLE)
    expect(menuItemNames().map((name) => name.replace(/The matches.*$|Share invite is unavailable.*$/, ''))).toEqual([
      'Open Responses',
      'Reopen Poll',
      'Matches Covered',
      'Delete Poll',
      'Share Invite',
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Reopen Poll' }))
    expect(await screen.findByRole('heading', { name: 'Reopen this poll' })).toBeInTheDocument()
  })
})

describe('PollCard - group poll', () => {
  it('shows the description title, the section and match count, and one slot summary per bracket, with no pencil', () => {
    renderCard({ kind: 'GROUP', round })

    expect(screen.getByRole('heading', { level: 3, name: 'Weekend fixtures' })).toBeInTheDocument()
    expect(screen.getByText('Group Poll')).toBeInTheDocument()
    expect(screen.queryByText('Home')).not.toBeInTheDocument()
    expect(screen.getByText('U13 Boys · 3 matches')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit description' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(2)
    expect(screen.getByTestId('w1-bar-AVAILABLE')).toHaveStyle({ width: '25%' })
    expect(screen.getByTestId('w2-bar-NONE')).toHaveStyle({ width: '100%' })
    expect(screen.getByText('Poll closes')).toBeInTheDocument()
    expect(screen.getByText('Manually')).toBeInTheDocument()
  })

  it('the kebab lists the group poll actions in order, with Edit Description and Matches Covered, Share Invite last', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round })
    await openActions(user, 'Weekend fixtures')
    expect(menuItemNames()).toEqual([
      'Open Responses',
      'Edit Close Time',
      'Edit Description',
      'Matches Covered',
      'Close Poll',
      'Delete Poll',
      'Share Invite',
    ])
  })

  it('Share Invite is disabled with its reason on a closed group poll', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round: { ...round, open: false } })
    await openActions(user, 'Weekend fixtures')
    const share = screen.getByRole('menuitem', { name: /Share Invite/ })
    expect(share).toHaveAttribute('aria-disabled', 'true')
    expect(share).toHaveTextContent('Share invite is unavailable: this poll is closed')
  })

  it('Share Invite opens the group invite dialog on an open group poll', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round })
    await choose(user, 'Weekend fixtures', 'Share Invite')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('Open Responses navigates to the group responses page', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round })
    await choose(user, 'Weekend fixtures', 'Open Responses')
    expect(await screen.findByText(/^At \/manage\/availability\/group\/round-1/)).toBeInTheDocument()
  })

  it('Matches Covered opens the matches dialog', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round })
    await choose(user, 'Weekend fixtures', 'Matches Covered')
    expect(await screen.findByRole('dialog', { name: 'Matches' })).toBeInTheDocument()
    expect(getRoundMatches).toHaveBeenCalledWith('club-1', 'round-1')
  })

  it('Edit Description opens a dialog and no inline panel appears', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round })
    await choose(user, 'Weekend fixtures', 'Edit Description')
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

  it('Open Responses goes to the same place as the title link', async () => {
    const user = userEvent.setup()
    renderCard(group)
    const href = screen.getByRole('link', { name: 'Weekend fixtures' }).getAttribute('href')
    await choose(user, 'Weekend fixtures', 'Open Responses')
    expect(await screen.findByText(`At ${href}`)).toBeInTheDocument()
  })

  it.each([
    ['Close Poll', 'Close this poll?'],
    ['Edit Description', 'Edit description'],
    ['Delete Poll', 'Delete this group poll?'],
    ['Edit Close Time', 'Edit close time'],
  ])('%s runs only its own action and does not navigate', async (itemName, dialogName) => {
    const user = userEvent.setup()
    renderCard(group)

    await choose(user, 'Weekend fixtures', itemName)

    expect(await screen.findByRole('dialog', { name: dialogName })).toBeInTheDocument()
    expect(screen.queryByText(/^At /)).not.toBeInTheDocument()
  })

  it('the kebab is positioned above the card link', () => {
    renderCard(group)
    expect(screen.getByRole('button', { name: 'Actions for Weekend fixtures' })).toHaveStyle({ position: 'relative' })
  })
})

describe('PollCard - Poll closes line', () => {
  it('shows the label with the formatted date and time while open, with no pencil', () => {
    renderCard({ kind: 'SQUAD', poll })

    const label = screen.getByText('Poll closes')
    const row = screen.getByTestId('poll-closes-row')
    expect(row).toHaveTextContent(new Date(poll.scheduledCloseAt as string).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))
    // The row has the calendar-cross icon and shares one strip with its label and value.
    expect(row.querySelector('[data-testid="EventBusyOutlinedIcon"]')).toBeInTheDocument()
    expect(row).toContainElement(label)
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  it('reads Manually when an open poll has Autoclose off', () => {
    renderCard({ kind: 'GROUP', round })

    expect(screen.getByText('Manually')).toBeInTheDocument()
  })

  it('reads Poll closed with the date only once closed', () => {
    renderCard({ kind: 'SQUAD', poll }, false)

    expect(screen.getByText('Poll closed')).toBeInTheDocument()
    expect(screen.queryByText('Poll closes')).not.toBeInTheDocument()
    const date = new Date(poll.scheduledCloseAt as string).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    expect(screen.getByText(date)).toBeInTheDocument()
  })

  it('reads Poll closed, Manually for a closed poll without Autoclose', () => {
    renderCard({ kind: 'GROUP', round: { ...round, open: false } })

    expect(screen.getByText('Poll closed')).toBeInTheDocument()
    expect(screen.getByText('Manually')).toBeInTheDocument()
  })

  it('Edit Close Time in the kebab opens the close time dialog', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll })
    await choose(user, SQUAD_TITLE, 'Edit Close Time')
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

  it('disables Reopen Poll with its reason when the matches are in the past', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'SQUAD', poll: { ...poll, canReopen: false } }, false)
    await openActions(user, SQUAD_TITLE)
    const reopen = screen.getByRole('menuitem', { name: /Reopen Poll/ })
    expect(reopen).toHaveAttribute('aria-disabled', 'true')
    expect(reopen).toHaveTextContent('The matches in this poll are in the past')
  })

  it('disables Reopen Poll on a closed group poll that cannot be reopened', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round: { ...round, open: false, canReopen: false } })
    await openActions(user, 'Weekend fixtures')
    expect(screen.getByRole('menuitem', { name: /Reopen Poll/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('enables Reopen Poll when canReopen is true', async () => {
    const user = userEvent.setup()
    renderCard({ kind: 'GROUP', round: { ...round, open: false, canReopen: true } })
    await openActions(user, 'Weekend fixtures')
    expect(screen.getByRole('menuitem', { name: 'Reopen Poll' })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('draws the brand availability icon tile instead of an avatar', () => {
    renderCard({ kind: 'SQUAD', poll })
    const tile = screen.getByTestId('brand-icon-tile')
    expect(tile).toHaveStyle({ width: '56px', height: '56px' })
    expect(document.querySelector('.MuiAvatar-root')).not.toBeInTheDocument()
  })
})
