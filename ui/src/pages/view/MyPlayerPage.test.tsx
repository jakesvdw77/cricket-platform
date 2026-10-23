import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import type { MyPlayer, MyPlayerSummary, MyPoll } from '../../api/myPlayersApi'
import MyPlayerPage from './MyPlayerPage'
import { calls, clearViewport, httpError, renderRoutes, routeApi, setPhone } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'
import { agent, makeMyPlayer } from '../../test/myPlayerFixtures'

vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Priya Naidoo' }, logout: vi.fn() } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 3C and slice 4: the player hub. Desktop shows the menu beside the card and the section; a phone shows the
// menu as its own screen and each section as a full screen of its own.
const http = api as unknown as ApiMock
const summary = (key: string): MyPlayerSummary => ({ key, firstName: 'A', lastName: 'B', photoUrl: null, clubId: 'c1', clubName: 'Riverside CC', groupLabel: null, self: false, main: true })
const poll = (id: string): MyPoll => ({ pollId: id, kind: 'SQUAD', title: `Poll ${id}`, teamName: 'U14 A', sectionName: null, homeName: 'Riverside', awayName: 'Hillcrest', matchDate: '2026-11-07T08:00:00Z', venue: 'Main oval', scheduledCloseAt: null, windows: [], answers: [] })

interface Setup {
  player?: MyPlayer
  players?: MyPlayerSummary[]
  polls?: MyPoll[]
  invitations?: unknown[]
  extra?: Record<string, unknown>
}

function setup(entry: string, { player = makeMyPlayer(), players = [summary('k1'), summary('k2')], polls = [], invitations = [], extra = {} }: Setup = {}) {
  routeApi(http, {
    'GET /me/players/k1': player,
    'GET /me/players/k1/polls': polls,
    'GET /me/players': players,
    'GET /me/invitations': invitations,
    'GET /me/link-requests': [],
    'POST /me/activate': { personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: [] },
    'GET /me/profiles': [],
    ...extra,
  })
  return renderRoutes(
    entry,
    <>
      <Route path="/account/players/:key" element={<MyPlayerPage />} />
      <Route path="/account/players/:key/:section" element={<MyPlayerPage />} />
      <Route path="/account/players/:key/:section/:sub" element={<MyPlayerPage />} />
    </>,
  )
}

const menu = () => screen.getByRole('navigation', { name: 'Player sections' })
const findMenu = () => screen.findByRole('navigation', { name: 'Player sections' })

beforeEach(() => vi.clearAllMocks())
afterEach(clearViewport)

describe('MyPlayerPage on a desktop', () => {
  it('opens on Availability with the section menu, the player card and the open polls', async () => {
    setup('/account/players/k1', { polls: [poll('a'), poll('b')] })

    expect(await screen.findByText('Aman Naidoo', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Riverside CC · Under 14')).toBeInTheDocument()
    expect(screen.getByText('JERSEY')).toBeInTheDocument()
    const bars = within(menu()).getAllByRole('button')
    expect(bars.map((bar) => bar.textContent)).toEqual(['Availability2 open', 'Profile', 'ScheduleSoon', 'StatsSoon', 'Link requests'])
    expect(within(menu()).getByRole('button', { name: /^Availability/ })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('heading', { name: 'Availability' })).toBeInTheDocument()
  })

  it('shows no open pill when there are no polls', async () => {
    setup('/account/players/k1/availability')

    expect(await screen.findByText(/No open availability polls for Aman right now/)).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: 'Availability' })).toBeInTheDocument()
    expect(screen.queryByText(/open$/)).not.toBeInTheDocument()
  })

  it('the section lives in the URL: choosing Profile shows the profile and marks it current', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1/availability')

    await user.click(await within(await findMenu()).findByRole('button', { name: 'Profile' }))

    expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(within(menu()).getByRole('button', { name: /^Availability/ })).not.toHaveAttribute('aria-current')
  })

  it('an unknown section means Availability', async () => {
    setup('/account/players/k1/nonsense')

    expect(await screen.findByText(/No open availability polls/)).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: /^Availability/ })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['schedule', 'Schedule', /Upcoming matches and training for this player will show here/],
    ['stats', 'Stats', /Personal bests, form and season progress/],
  ])('%s is selectable but a locked panel that says Coming soon', async (path, label, text) => {
    setup(`/account/players/k1/${path}`)

    expect(await screen.findByRole('heading', { name: label })).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: new RegExp(`^${label}`) })).toHaveAttribute('aria-current', 'page')
    expect(within(menu()).getAllByText('Soon')).toHaveLength(2)
  })

  it('shows an Invitations bar with the count when invitations are waiting, opening the invitations page', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1/profile', { invitations: [{ linkId: 'l1' }, { linkId: 'l2' }] })

    await user.click(await within(await findMenu()).findByRole('button', { name: /^Invitations/ }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/account/invitations')
  })

  it('has no Invitations bar without invitations', async () => {
    setup('/account/players/k1/profile')

    await screen.findByTestId('hub-profile')
    expect(within(menu()).queryByRole('button', { name: /^Invitations/ })).not.toBeInTheDocument()
  })

  describe('the footer Back', () => {
    it('is Back to players for a person with several players', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile')

      await user.click(await screen.findByRole('button', { name: 'Back to players' }))

      expect(await screen.findByTestId('location')).toHaveTextContent('/account')
    })

    it('is hidden for a single player, who gets Find more players instead', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile', { players: [summary('k1')] })

      await screen.findByTestId('hub-profile')
      expect(screen.queryByRole('button', { name: 'Back to players' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Find more players' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/welcome')
    })
  })

  it('the Link requests section lists the requests with Find more players', async () => {
    setup('/account/players/k1/requests')

    expect(await screen.findByRole('heading', { name: 'Link requests' })).toBeInTheDocument()
    expect(await screen.findByText('You have not sent any requests yet.')).toBeInTheDocument()
  })

  it('shows an error when the player cannot be loaded', async () => {
    setup('/account/players/k1/profile', { extra: { 'GET /me/players/k1': httpError(404) } })

    expect(await screen.findByText('We could not load this player. Please try again.')).toBeInTheDocument()
  })

  describe('Profile sub-views replace the console body with their own Back', () => {
    it('edit shows the dark form with no menu', async () => {
      setup('/account/players/k1/profile/edit')

      expect(await screen.findByTestId('my-player-edit-form')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Edit Profile' })).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Player sections' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Back to players' })).not.toBeInTheDocument()
    })

    it('Hand over from the profile opens the hand over view, and Back to profile returns', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile', { player: makeMyPlayer({ agents: [agent()], agentCount: 1 }) })

      await user.click(await screen.findByRole('button', { name: 'Hand over' }))
      expect(await screen.findByTestId('agent-change-view')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Hand Over' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Back to profile' }))
      expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
    })

    it('Leave deletes the caller\'s own link and goes back to the players', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile/leave', {
        player: makeMyPlayer({ main: false, canManageAgents: false }),
        extra: { 'DELETE /me/links/my-link': {} },
      })

      await user.click(await screen.findByRole('button', { name: 'Yes, leave' }))

      expect(await screen.findByTestId('location')).toHaveTextContent('/account')
      expect(calls(http.delete, '/me/links/my-link')).toHaveLength(1)
    })

    it('cancel invitation uses the link in the URL', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile/cancel-invite?link=l9', { extra: { 'DELETE /me/links/l9': {} } })

      await user.click(await screen.findByRole('button', { name: 'Yes, cancel it' }))

      expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
      expect(calls(http.delete, '/me/links/l9')).toHaveLength(1)
    })
  })
})

describe('MyPlayerPage on a phone (menu first, then a section)', () => {
  beforeEach(() => setPhone(true))

  it('the base URL is the menu screen: the player card and the bars, with no section panel', async () => {
    setup('/account/players/k1', { polls: [poll('a')] })

    await within(await findMenu()).findByText('1 open')
    const bars = within(menu()).getAllByRole('button')
    expect(bars.map((bar) => bar.textContent)).toEqual(['Availability1 open', 'Profile', 'ScheduleSoon', 'StatsSoon', 'Link requests'])
    expect(bars.some((bar) => bar.getAttribute('aria-current') === 'page')).toBe(false)
    expect(screen.queryByRole('heading', { name: 'Availability' })).not.toBeInTheDocument()
    expect(await screen.findByText('JERSEY')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to menu' })).not.toBeInTheDocument()
  })

  it('choosing a bar opens that section as its own screen with Back to menu, which returns to the menu', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1')

    await user.click(await within(await findMenu()).findByRole('button', { name: 'Profile' }))

    expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Player sections' })).not.toBeInTheDocument()
    expect(screen.queryByText('JERSEY')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to players' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to menu' }))
    expect(await within(await findMenu()).findByRole('button', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.queryByTestId('hub-profile')).not.toBeInTheDocument()
  })

  it('a locked section is a full screen too', async () => {
    setup('/account/players/k1/stats')

    expect(await screen.findByText('Coming soon')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Back to menu' })).toBeInTheDocument()
  })

  it('a sub-view has no Back to menu, only its own Back', async () => {
    setup('/account/players/k1/profile/edit')

    expect(await screen.findByTestId('my-player-edit-form')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to profile' })).toBeInTheDocument()
  })
})
