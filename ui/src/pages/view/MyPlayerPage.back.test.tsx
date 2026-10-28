import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import MyPlayerPage from './MyPlayerPage'
import { clearViewport, renderRoutes, routeApi, setPhone } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'
import { makeMyPlayer } from '../../test/myPlayerFixtures'

vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Priya Naidoo' }, logout: vi.fn() } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/121 Decision 15: one Back per screen, always the footer's, at phone and desktop widths; a dirty Profile edit view
// asks before it leaves, from the footer Back and from Escape (which never fires inside a text input or an open menu).
const http = api as unknown as ApiMock
const summary = (key: string) => ({ key, firstName: 'A', lastName: 'B', photoUrl: null, clubId: 'c1', clubName: 'Riverside CC', groupLabel: null, self: false, main: true })

function setup(entry: string) {
  routeApi(http, {
    'GET /me/players/k1': makeMyPlayer(),
    'GET /me/players/k1/polls': [],
    'GET /me/players/k1/fields': [],
    'GET /me/players': [summary('k1'), summary('k2')],
    'GET /me/invitations': [],
    'GET /me/link-requests': [],
    'GET /me/profiles': [],
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

const backControls = () => screen.queryAllByRole('button', { name: /^Back\b/ })
// The player list (which decides Back to players) loads after the page, so wait for the footer before counting.
const footerBack = () => waitFor(() => expect(backControls().length).toBeGreaterThan(0))

beforeEach(() => vi.clearAllMocks())
afterEach(clearViewport)

describe.each([
  ['375 px (phone)', true],
  ['1280 px (desktop)', false],
])('one Back per screen at %s', (_label, phone) => {
  beforeEach(() => setPhone(phone))

  it.each([
    ['a page', '/account/players/k1/availability', 'Availability'],
    ['a sub menu page', '/account/players/k1/club/fields', 'Field Directory'],
    ['a Soon page', '/account/players/k1/schedule/matches', 'Matches'],
    ['a Profile page', '/account/players/k1/profile/contact', 'Contact'],
  ])('%s has exactly one Back control and it is the footer', async (_name, path, heading) => {
    setup(path)
    await screen.findAllByRole('heading', { name: heading })
    await footerBack()

    const backs = backControls()
    expect(backs).toHaveLength(1)
    expect(backs[0].closest('footer')).not.toBeNull()
  })

  it('a Profile edit view has exactly one Back, the footer\'s Back to Profile', async () => {
    setup('/account/players/k1/profile/contact/edit')
    await screen.findByTestId('my-player-edit-form')

    const backs = backControls()
    expect(backs).toHaveLength(1)
    expect(backs[0]).toHaveAccessibleName('Back to Profile')
    expect(backs[0].closest('footer')).not.toBeNull()
  })

  it('the Agents edit view has exactly one Back too', async () => {
    setup('/account/players/k1/profile/agents/edit')
    await screen.findByTestId('agent-change-view')

    expect(backControls()).toHaveLength(1)
    expect(backControls()[0].closest('footer')).not.toBeNull()
  })

  it('the main menu has one Back, to players, and it is the footer', async () => {
    setup(phone ? '/account/players/k1' : '/account/players/k1/availability')
    await screen.findByRole('navigation', { name: 'Player sections' })
    await footerBack()

    expect(backControls()).toHaveLength(1)
    expect(backControls()[0]).toHaveAccessibleName('Back to players')
    expect(backControls()[0].closest('footer')).not.toBeNull()
  })
})

describe('the dirty leave guard on a Profile edit view', () => {
  beforeEach(() => setPhone(false))

  async function dirtyEdit(user: ReturnType<typeof userEvent.setup>, path = '/account/players/k1/profile/contact/edit') {
    setup(path)
    await screen.findByTestId('my-player-edit-form')
    await user.type(screen.getByLabelText('Alternative contact name'), 'x')
  }

  it('the footer Back on a clean form leaves at once', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1/profile/contact/edit')
    await screen.findByTestId('my-player-edit-form')

    await user.click(screen.getByRole('button', { name: 'Back to Profile' }))

    expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
    expect(screen.queryByTestId('hub-leave-confirm')).not.toBeInTheDocument()
  })

  it('the footer Back on a dirty form asks first, Keep editing stays, and Discard leaves', async () => {
    const user = userEvent.setup()
    await dirtyEdit(user)

    await user.click(screen.getByRole('button', { name: 'Back to Profile' }))
    const confirm = await screen.findByTestId('hub-leave-confirm')
    expect(within(confirm).getByText('Discard your changes?')).toBeInTheDocument()
    expect(screen.getByTestId('my-player-edit-form')).toBeInTheDocument()

    await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByTestId('hub-leave-confirm')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Alternative contact name')).toHaveValue('Priya Naidoox')

    await user.click(screen.getByRole('button', { name: 'Back to Profile' }))
    await user.click(within(await screen.findByTestId('hub-leave-confirm')).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
  })

  it('Escape outside a text field behaves like the footer Back: it asks when dirty', async () => {
    const user = userEvent.setup()
    await dirtyEdit(user)
    ;(document.activeElement as HTMLElement).blur()

    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(await screen.findByTestId('hub-leave-confirm')).toBeInTheDocument()
  })

  it('Escape on a clean view leaves at once', async () => {
    setup('/account/players/k1/profile/contact/edit')
    await screen.findByTestId('my-player-edit-form')

    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(await screen.findByTestId('hub-profile')).toBeInTheDocument()
  })

  it('Escape inside a text input does nothing', async () => {
    const user = userEvent.setup()
    await dirtyEdit(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('hub-leave-confirm')).not.toBeInTheDocument()
    expect(screen.getByTestId('my-player-edit-form')).toBeInTheDocument()
    expect(screen.getByLabelText('Alternative contact name')).toHaveFocus()
  })

  it('Escape inside an input also does nothing on a clean form', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1/profile/contact/edit')
    await screen.findByTestId('my-player-edit-form')
    await user.click(screen.getByLabelText('Alternative contact name'))

    await user.keyboard('{Escape}')

    expect(screen.getByTestId('my-player-edit-form')).toBeInTheDocument()
  })

  it('Escape closing an open menu does not leave the view', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1/profile/cricket/edit')
    await screen.findByTestId('my-player-edit-form')
    await user.click(screen.getByRole('combobox', { name: 'Batting stance' }))
    await screen.findByRole('listbox')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(screen.getByTestId('my-player-edit-form')).toBeInTheDocument()
    expect(screen.queryByTestId('hub-profile')).not.toBeInTheDocument()
  })
})

describe('Escape in the Field Directory', () => {
  beforeEach(() => setPhone(false))

  it('clears the search first, then a second Escape runs the footer Back', async () => {
    const user = userEvent.setup()
    setup('/account/players/k1/club/fields')
    const box = await screen.findByRole('textbox', { name: 'Search fields' })

    await user.type(box, 'oval')
    await user.keyboard('{Escape}')
    expect(box).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Field Directory' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(await within(await screen.findByRole('navigation', { name: 'Player sections' })).findByRole('button', { name: /^Availability/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { name: 'Field Directory' })).not.toBeInTheDocument()
  })
})
