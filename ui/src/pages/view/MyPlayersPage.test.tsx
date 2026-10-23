import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import type { MyInvitation, MyLinkRequest } from '../../api/meApi'
import type { MyPlayerSummary } from '../../api/myPlayersApi'
import MyPlayersPage from './MyPlayersPage'
import { httpError, renderRoutes, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Priya Naidoo' }, logout: vi.fn() } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 3C and slice 4: /account is the picker; one player skips it unless an invitation is waiting.
const http = api as unknown as ApiMock
const player = (overrides: Partial<MyPlayerSummary> = {}): MyPlayerSummary => ({
  key: 'k1',
  firstName: 'Priya',
  lastName: 'Naidoo',
  photoUrl: null,
  clubId: 'c1',
  clubName: 'Riverside CC',
  groupLabel: 'Seniors',
  self: true,
  main: true,
  ...overrides,
})
const AMAN = player({ key: 'k2', firstName: 'Aman', lastName: 'Naidoo', self: false })
const invitation = (overrides: Partial<MyInvitation> = {}): MyInvitation => ({ linkId: 'l1', playerName: 'Zane Botha', clubName: 'Riverside CC', invitedByName: 'Sam Smith', makeMain: false, expiresAt: '2026-11-06T10:00:00Z', ...overrides })
const request = (overrides: Partial<MyLinkRequest>): MyLinkRequest => ({ id: 'r1', clubName: 'Riverside CC', playerName: 'Yusuf Khan', status: 'PENDING', createdAt: '2026-10-01T10:00:00Z', ...overrides })

function setup(players: MyPlayerSummary[] | Error, extra: Record<string, unknown> = {}, entry = '/account') {
  routeApi(http, {
    'GET /me/players': players,
    'GET /me/link-requests': [],
    'GET /me/invitations': [],
    'POST /me/activate': { personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: [] },
    'GET /me/profiles': [],
    ...extra,
  })
  return renderRoutes(
    entry,
    <>
      <Route path="/account" element={<MyPlayersPage />} />
      <Route path="/account/players/:key" element={<div>Hub of player</div>} />
    </>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('MyPlayersPage', () => {
  it('lists one tile per player in the order given (own record first) with a You chip on the own record', async () => {
    setup([player(), AMAN])

    const list = await screen.findByRole('list', { name: 'My players' })
    const tiles = within(list).getAllByRole('button')
    expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['Priya Naidoo', 'Aman Naidoo'])
    expect(within(tiles[0]).getByText('You')).toBeInTheDocument()
    expect(within(tiles[1]).queryByText('You')).not.toBeInTheDocument()
  })

  it('opens that player\'s hub when a tile is chosen', async () => {
    setup([player(), AMAN])

    await userEvent.click(await screen.findByRole('button', { name: 'Aman Naidoo' }))

    expect(await screen.findByText('Hub of player')).toBeInTheDocument()
  })

  it('skips the picker for a single player', async () => {
    setup([AMAN])

    expect(await screen.findByText('Hub of player')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'My players' })).not.toBeInTheDocument()
  })

  it('keeps the picker for a single player when an invitation is waiting, with the banner', async () => {
    setup([AMAN], { 'GET /me/invitations': [invitation()] })

    expect(await screen.findByTestId('invitations-banner')).toHaveTextContent('1 invitation waiting for you')
    expect(screen.queryByText('Hub of player')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aman Naidoo' })).toBeInTheDocument()
  })

  it('counts several invitations and the banner opens the invitations page', async () => {
    setup([player(), AMAN], { 'GET /me/invitations': [invitation(), invitation({ linkId: 'l2' })] })

    const banner = await screen.findByTestId('invitations-banner')
    expect(banner).toHaveTextContent('2 invitations waiting for you')
    await userEvent.click(banner)
    expect(await screen.findByTestId('location')).toHaveTextContent('/account/invitations')
  })

  it('has no banner without invitations', async () => {
    setup([player(), AMAN])

    await screen.findByRole('list', { name: 'My players' })
    expect(screen.queryByTestId('invitations-banner')).not.toBeInTheDocument()
  })

  it('goes straight to a hub from the older ?player= link when that player is the person\'s', async () => {
    setup([player(), AMAN], {}, '/account?player=k2')

    expect(await screen.findByText('Hub of player')).toBeInTheDocument()
  })

  it('shows only Waiting and Declined requests, with the club name on a waiting one', async () => {
    setup([player(), AMAN], {
      'GET /me/link-requests': [
        request({ id: 'r1', status: 'PENDING' }),
        request({ id: 'r2', status: 'DECLINED', playerName: 'Declined Dan', decisionNote: 'Not a member' }),
        request({ id: 'r3', status: 'APPROVED', playerName: 'Approved Ann' }),
        request({ id: 'r4', status: 'CANCELLED', playerName: 'Cancelled Cal' }),
      ],
    })

    const section = await screen.findByTestId('my-requests')
    expect(within(section).getByText('Waiting for Riverside CC')).toBeInTheDocument()
    expect(within(section).getByText('Declined')).toBeInTheDocument()
    expect(within(section).getByText('Note from the club: Not a member')).toBeInTheDocument()
    expect(within(section).queryByText('Approved Ann')).not.toBeInTheDocument()
    expect(within(section).queryByText('Cancelled Cal')).not.toBeInTheDocument()
    expect(within(section).queryByText('Accepted')).not.toBeInTheDocument()
  })

  it('hides the requests section when none is waiting or declined', async () => {
    setup([player(), AMAN], { 'GET /me/link-requests': [request({ status: 'APPROVED' })] })

    await screen.findByRole('list', { name: 'My players' })
    expect(screen.queryByTestId('my-requests')).not.toBeInTheDocument()
  })

  it('shows the empty state and Find more players, which goes to /welcome', async () => {
    setup([])

    expect(await screen.findByText('No players yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Find more players' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/welcome')
  })

  it('shows an error when the players cannot be loaded', async () => {
    setup(httpError(500))

    expect(await screen.findByText('Something went wrong loading your players. Please try again later.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Find more players' })).not.toBeInTheDocument()
  })
})
