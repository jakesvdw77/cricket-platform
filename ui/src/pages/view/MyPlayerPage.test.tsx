import { screen, waitFor, within } from '@testing-library/react'
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

// docs/specs/121: the player hub. Seven menu items; a parent opens its first page with its sub menu in the column (a pill row on a
// phone); the footer has one Back (hubBack); Profile is Contact, Cricket and Agents with one Edit per page.
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
      <Route path="/account/players/:key/:section/:sub/:leaf" element={<MyPlayerPage />} />
    </>,
  )
}

const menu = () => screen.getByRole('navigation', { name: 'Player sections' })
const findMenu = () => screen.findByRole('navigation', { name: 'Player sections' })

beforeEach(() => vi.clearAllMocks())
afterEach(clearViewport)

const ROOT_BARS = ['Availability', 'Updates', 'Schedule', 'Stats', 'Club', 'Profile', 'Account']

describe('MyPlayerPage on a desktop', () => {
  it('opens on Availability with the seven-item menu, the player card and the open polls', async () => {
    setup('/account/players/k1', { polls: [poll('a'), poll('b')] })

    expect(await screen.findByText('Aman Naidoo', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Riverside CC · Under 14')).toBeInTheDocument()
    const bars = within(menu()).getAllByRole('button')
    expect(bars.map((bar) => bar.textContent)).toEqual(['2Availability', ...ROOT_BARS.slice(1)])
    expect(within(menu()).getByRole('button', { name: /^Availability/ })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('heading', { name: 'Availability' })).toBeInTheDocument()
  })

  it('shows no open pill when there are no polls', async () => {
    setup('/account/players/k1/availability')

    expect(await screen.findByText(/No open availability polls for Aman right now/)).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: 'Availability' })).toBeInTheDocument()
    expect(screen.queryByText(/open$/)).not.toBeInTheDocument()
  })

  it('the section lives in the URL: choosing Profile opens Contact with the Profile sub menu', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1/availability')

    await user.click(await within(await findMenu()).findByRole('button', { name: /^Profile/ }))

    expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
    expect(screen.getByTestId('profile-card')).toBeInTheDocument()
    expect(within(menu()).getAllByRole('button').map((bar) => bar.textContent)).toEqual(['Contact', 'Cricket', 'Agents'])
    expect(within(menu()).getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-current', 'page')

    await user.click(within(menu()).getByRole('button', { name: 'Cricket' }))
    expect(within(menu()).getByRole('button', { name: 'Cricket' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Cricket' })).toBeInTheDocument()
  })

  it('an unknown section means Availability', async () => {
    setup('/account/players/k1/nonsense')

    expect(await screen.findByText(/No open availability polls/)).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: /^Availability/ })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['schedule/matches', 'Matches', /Upcoming matches and training for this player will show here/],
    ['stats', 'My stats', /Personal bests, form and season progress/],
  ])('%s opens on its first child, a locked panel that says Coming soon', async (path, label, text) => {
    setup(`/account/players/k1/${path}`)

    expect(await screen.findByRole('heading', { name: label })).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: new RegExp(`^${label}`) })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the Invitations count under Account, opening the invitations page in the hub', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1/availability', { invitations: [{ linkId: 'l1' }, { linkId: 'l2' }] })

    await user.click(await within(await findMenu()).findByRole('button', { name: /^Account, 2 new/ }))

    expect(await screen.findByRole('heading', { name: 'Invitations' })).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: /^Invitations, 2/ })).toHaveAttribute('aria-current', 'page')
  })

  it('has no Invitations count without invitations', async () => {
    setup('/account/players/k1/account')

    expect(await screen.findByRole('heading', { name: 'Invitations' })).toBeInTheDocument()
    expect(within(menu()).getByRole('button', { name: 'Invitations' })).toBeInTheDocument()
  })

  describe('the footer Back', () => {
    it('is Back to players on the main menu for a person with several players', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/availability')

      await user.click(await screen.findByRole('button', { name: 'Back to players' }))

      expect(await screen.findByTestId('location')).toHaveTextContent('/account')
    })

    it('is Back to menu inside a section, returning to Availability with the main menu', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile/contact')

      await user.click(await screen.findByRole('button', { name: 'Back to menu' }))

      expect(await within(await findMenu()).findByRole('button', { name: /^Availability/ })).toHaveAttribute('aria-current', 'page')
      expect(screen.queryByTestId('hub-profile')).not.toBeInTheDocument()
    })

    it('is hidden for a single player, who links more players from Account', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/availability', { players: [summary('k1')] })

      await within(await findMenu()).findByRole('button', { name: /^Availability/ })
      expect(screen.queryByRole('button', { name: 'Back to players' })).not.toBeInTheDocument()
      await user.click(within(menu()).getByRole('button', { name: /^Account/ }))
      await user.click(await within(menu()).findByRole('button', { name: 'Link more players' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/welcome')
    })
  })

  it('the Link requests page lists the requests', async () => {
    setup('/account/players/k1/account/requests')

    expect(await screen.findByRole('heading', { name: 'Link requests' })).toBeInTheDocument()
    expect(await screen.findByText('You have not sent any requests yet.')).toBeInTheDocument()
  })

  it('shows an error when the player cannot be loaded', async () => {
    setup('/account/players/k1/profile', { extra: { 'GET /me/players/k1': httpError(404) } })

    expect(await screen.findByText('We could not load this player. Please try again.')).toBeInTheDocument()
  })

  describe('Profile sub-views replace the console body, with the footer Back to Profile', () => {
    it('edit shows the dark form for that page with no menu', async () => {
      setup('/account/players/k1/profile/contact/edit')

      expect(await screen.findByTestId('my-player-edit-form')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Edit contact' })).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Player sections' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Back to players' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to Profile' })).toBeInTheDocument()
    })

    it('the Agents Edit opens the edit view, where the toggle switches to hand over, and Back to Profile returns', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile/agents', { player: makeMyPlayer({ agents: [agent()], agentCount: 1 }) })

      await user.click(await screen.findByRole('button', { name: 'Edit' }))
      expect(await screen.findByTestId('agent-change-view')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Edit agents' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Hand over (change primary agent)' }))
      expect(screen.getByRole('button', { name: 'Hand over (change primary agent)' })).toHaveAttribute('aria-pressed', 'true')

      await user.click(screen.getByRole('button', { name: 'Back to Profile' }))
      expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
    })

    it('Leave deletes the caller\'s own link and goes back to the players', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile/agents/leave', {
        player: makeMyPlayer({ main: false, canManageAgents: false }),
        extra: { 'DELETE /me/links/my-link': {} },
      })

      await user.click(await screen.findByRole('button', { name: 'Yes, leave' }))

      expect(await screen.findByTestId('location')).toHaveTextContent('/account')
      expect(calls(http.delete, '/me/links/my-link')).toHaveLength(1)
    })

    it('a pending invitation is cancelled from the Agents edit view', async () => {
      const user = userEvent.setup()
      setup('/account/players/k1/profile/agents/edit', {
        player: makeMyPlayer({ agents: [agent(), agent({ linkId: 'l9', name: 'Sam Smith', main: false, status: 'INVITED' })], agentCount: 2 }),
        extra: { 'DELETE /me/links/l9': {} },
      })

      await user.click(await screen.findByRole('button', { name: 'Cancel invitation' }))
      await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }))

      await waitFor(() => expect(calls(http.delete, '/me/links/l9')).toHaveLength(1))
    })
  })
})

describe('MyPlayerPage on a phone (menu first, then a page)', () => {
  beforeEach(() => setPhone(true))

  it('the base URL is the menu screen: the player card and the seven bars, with no page', async () => {
    setup('/account/players/k1', { polls: [poll('a')] })

    await within(await findMenu()).findByRole('button', { name: /^Availability, 1 open/ })
    const bars = within(menu()).getAllByRole('button')
    expect(bars.map((bar) => bar.textContent)).toEqual(['1Availability', ...ROOT_BARS.slice(1)])
    expect(bars.some((bar) => bar.getAttribute('aria-current') === 'page')).toBe(false)
    expect(screen.queryByRole('heading', { name: 'Availability' })).not.toBeInTheDocument()
    expect(await screen.findByTestId('hub-player-card')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to menu' })).not.toBeInTheDocument()
  })

  it('choosing a bar opens its first page with a pill row, and Back to menu returns to the menu', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1')

    await user.click(await within(await findMenu()).findByRole('button', { name: /^Profile/ }))

    expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Player sections' })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Profile pages' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to players' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to menu' }))
    expect(await within(await findMenu()).findByRole('button', { name: /^Profile/ })).toBeInTheDocument()
    expect(screen.queryByTestId('hub-profile')).not.toBeInTheDocument()
  })

  it('a locked section is a full screen too', async () => {
    setup('/account/players/k1/stats')

    expect(await screen.findByText('Coming soon')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Back to menu' })).toBeInTheDocument()
  })

  it('a sub-view has no Back to menu, only Back to Profile', async () => {
    setup('/account/players/k1/profile/contact/edit')

    expect(await screen.findByTestId('my-player-edit-form')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Profile' })).toBeInTheDocument()
  })
})
