import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import type { MainAgentMatch, PlayerMatch, PlayerMatches } from '../../api/meApi'
import FindYourPlayersPage from './FindYourPlayersPage'
import { calls, httpError, renderRoutes, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Priya Naidoo', email: 'priya@example.com' }, logout: vi.fn() } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 Part 3: matches are minimised (first name, surname initial, birth year, masked email), every state has a Back.
const http = api as unknown as ApiMock
const free = (overrides: Partial<PlayerMatch> = {}): PlayerMatch => ({
  ref: 'ref-1',
  firstName: 'Aman',
  surnameInitial: 'N',
  clubId: 'c1',
  clubName: 'Riverside CC',
  groupLabel: 'Under 14',
  birthYear: 2012,
  adult: false,
  ...overrides,
})
const taken = (overrides: Partial<MainAgentMatch> = {}): MainAgentMatch => ({ ...free({ ref: 'ref-t1', firstName: 'Zane', surnameInitial: 'B', birthYear: 2010 }), maskedMainAgentEmail: 's***@example.com', ...overrides })

function setup(matches: PlayerMatches, extra: Record<string, unknown> = {}) {
  routeApi(http, {
    'POST /me/register': {},
    'GET /me/player-matches': matches,
    'POST /me/links': { linked: [] },
    'GET /me/players': [],
    'GET /me/clubs': [{ id: 'c1', name: 'Riverside CC' }],
    'GET /me/link-requests': [],
    'POST /me/link-requests': { message: 'ok' },
    'POST /me/activate': { personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: [] },
    'GET /me/profiles': [],
    ...extra,
  })
  return renderRoutes('/welcome', <Route path="/welcome" element={<FindYourPlayersPage />} />)
}

const fill = async (user: ReturnType<typeof userEvent.setup>, form: HTMLElement, values: { first?: string; last: string; dob: string; phone: string }) => {
  if (values.first) await user.type(within(form).getByLabelText('First name'), values.first)
  await user.type(within(form).getByLabelText('Surname'), values.last)
  fireEvent.change(within(form).getByLabelText('Date of birth'), { target: { value: values.dob } })
  await user.type(within(form).getByLabelText('Contact number'), values.phone)
}

beforeEach(() => vi.clearAllMocks())

describe('FindYourPlayersPage', () => {
  describe('matched players with no main agent', () => {
    it('registers once, then shows a pre-ticked list with the birth year and no full date of birth', async () => {
      setup({ withoutMainAgent: [free(), free({ ref: 'ref-2', firstName: 'Zara', surnameInitial: 'N', birthYear: 2014 })], withMainAgent: [] })

      expect(await screen.findByRole('heading', { name: 'Are these your players?' })).toBeInTheDocument()
      expect(calls(http.post, '/me/register')).toHaveLength(1)
      expect(screen.getByText('We found these on record for priya@example.com. Untick any that are not yours.')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Aman N.' })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Zara N.' })).toBeChecked()
      expect(screen.getByText('Riverside CC · Under 14 · Born 2012')).toBeInTheDocument()
      expect(screen.getByText('Riverside CC · Under 14 · Born 2014')).toBeInTheDocument()
      // Minimised: an initial only, and never a full date.
      expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(document.body.textContent).not.toMatch(/Naidoo/)
    })

    it('asks "Is this you?" for a single adult match', async () => {
      setup({ withoutMainAgent: [free({ adult: true, birthYear: 1990 })], withMainAgent: [] })

      expect(await screen.findByRole('heading', { name: 'Is this you?' })).toBeInTheDocument()
    })

    it('Confirm links only the ticked players, after the others are unticked', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [free(), free({ ref: 'ref-2', firstName: 'Zara', surnameInitial: 'N' })], withMainAgent: [] })

      await user.click(await screen.findByRole('checkbox', { name: 'Zara N.' }))
      expect(screen.getByRole('checkbox', { name: 'Zara N.' })).not.toBeChecked()
      await user.click(screen.getByRole('button', { name: 'Confirm' }))

      await waitFor(() => expect(calls(http.post, '/me/links')).toHaveLength(1))
      expect(calls(http.post, '/me/links')[0][1]).toEqual({ confirm: true, playerRefs: ['ref-1'] })
      expect(await screen.findByRole('heading', { name: 'You now manage Aman N.' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Go to Player Hub' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/account')
    })

    it('disables Confirm when everyone is unticked', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [free()], withMainAgent: [] })

      await user.click(await screen.findByRole('checkbox', { name: 'Aman N.' }))

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    })

    it('says so when linking fails and lets the person try again', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [free()], withMainAgent: [] }, { 'POST /me/links': httpError(500) })

      await user.click(await screen.findByRole('button', { name: 'Confirm' }))

      expect(await screen.findByText('We could not link those players. Please try again.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
    })
  })

  describe('No player found', () => {
    it('shows the request form with a required contact number and full date of birth, and sends the request', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [], withMainAgent: [] })

      expect(await screen.findByRole('heading', { name: 'No player found' })).toBeInTheDocument()
      expect(screen.getByText((_, node) => node?.tagName === 'P' && /We could not find a player with priya@example.com at any club/.test(node.textContent ?? ''))).toBeInTheDocument()
      const form = await screen.findByTestId('link-request-form')

      await user.click(within(form).getByRole('button', { name: 'Send request' }))
      expect(within(form).getByText('Enter a contact number')).toBeInTheDocument()
      expect(within(form).getByText('Enter the full date of birth')).toBeInTheDocument()
      expect(calls(http.post, '/me/link-requests')).toHaveLength(0)

      await fill(user, form, { first: 'Aman', last: 'Naidoo', dob: '2012-03-04', phone: '082 555 0100' })
      await user.click(within(form).getByRole('button', { name: 'Send request' }))

      await waitFor(() => expect(calls(http.post, '/me/link-requests')).toHaveLength(1))
      expect(calls(http.post, '/me/link-requests')[0][1]).toEqual({
        clubId: 'c1',
        firstName: 'Aman',
        lastName: 'Naidoo',
        dateOfBirth: '2012-03-04',
        contactNumber: '082 555 0100',
      })
      expect(await screen.findByRole('heading', { name: 'Thanks, the club will review this' })).toBeInTheDocument()
    })

    it('every state after it has a Back: the sent confirmation and My requests return to the form state', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [], withMainAgent: [] })

      const form = await screen.findByTestId('link-request-form')
      await fill(user, form, { first: 'Aman', last: 'Naidoo', dob: '2012-03-04', phone: '0825550100' })
      await user.click(within(form).getByRole('button', { name: 'Send request' }))

      await screen.findByRole('heading', { name: 'Thanks, the club will review this' })
      await user.click(screen.getByRole('button', { name: 'See my requests' }))
      expect(await screen.findByRole('heading', { name: 'My requests' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Back' }))
      expect(await screen.findByRole('heading', { name: 'No player found' })).toBeInTheDocument()
    })

    it('Send another request goes back to the start', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [], withMainAgent: [] })

      const form = await screen.findByTestId('link-request-form')
      await fill(user, form, { first: 'Aman', last: 'Naidoo', dob: '2012-03-04', phone: '0825550100' })
      await user.click(within(form).getByRole('button', { name: 'Send request' }))
      await user.click(await screen.findByRole('button', { name: 'Send another request' }))

      expect(await screen.findByTestId('link-request-form')).toBeInTheDocument()
    })
  })

  describe('players that already have a main agent', () => {
    it('shows a masked-contact block, never the full address, and no Confirm when everyone has an agent', async () => {
      setup({ withoutMainAgent: [], withMainAgent: [taken()] })

      expect(await screen.findByRole('heading', { name: 'Contact the main agent' })).toBeInTheDocument()
      const block = within(screen.getByTestId('main-agent-block'))
      expect(block.getByText('Zane B.')).toBeInTheDocument()
      expect(block.getByText('Main agent: s***@example.com')).toBeInTheDocument()
      expect(block.getByText(/We never show the full address/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    })

    it('Ask the club to help opens the form with the player and club prefilled, and Back returns', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [], withMainAgent: [taken()] })

      await user.click(await screen.findByRole('button', { name: 'Ask the club to help' }))

      expect(await screen.findByRole('heading', { name: 'Ask the club to help' })).toBeInTheDocument()
      const form = screen.getByTestId('link-request-form')
      expect(within(form).getByLabelText('First name')).toHaveValue('Zane')
      expect(within(form).getByText('Starts with B')).toBeInTheDocument()
      await waitFor(() => expect(within(form).getByRole('combobox', { name: 'Club' })).toHaveTextContent('Riverside CC'))

      await user.click(screen.getByRole('button', { name: 'Back' }))
      expect(await screen.findByTestId('main-agent-block')).toBeInTheDocument()
    })

    it('sends the clubId and targetPlayerRef of the player asked about', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [], withMainAgent: [taken()] })

      await user.click(await screen.findByRole('button', { name: 'Ask the club to help' }))
      const form = await screen.findByTestId('link-request-form')
      await fill(user, form, { last: 'Botha', dob: '2010-05-06', phone: '0825550100' })
      await waitFor(() => expect(within(form).getByRole('combobox', { name: 'Club' })).toHaveTextContent('Riverside CC'))
      await user.click(within(form).getByRole('button', { name: 'Send request' }))

      await waitFor(() => expect(calls(http.post, '/me/link-requests')).toHaveLength(1))
      expect(calls(http.post, '/me/link-requests')[0][1]).toMatchObject({ clubId: 'c1', firstName: 'Zane', lastName: 'Botha', targetPlayerRef: 'ref-t1' })
    })

    it('names the player on each button when there are several', async () => {
      setup({ withoutMainAgent: [], withMainAgent: [taken(), taken({ ref: 'ref-t2', firstName: 'Yusuf', surnameInitial: 'K' })] })

      expect(await screen.findByRole('button', { name: 'Ask the club to help with Zane B.' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ask the club to help with Yusuf K.' })).toBeInTheDocument()
    })

    it('shows the free list and the contact block together, with the free players pre-ticked', async () => {
      setup({ withoutMainAgent: [free()], withMainAgent: [taken()] })

      expect(await screen.findByRole('checkbox', { name: 'Aman N.' })).toBeChecked()
      expect(within(screen.getByTestId('main-agent-block')).getByText('Zane B.')).toBeInTheDocument()
      expect(screen.getAllByRole('heading', { name: 'Contact the main agent' })).toHaveLength(1)
    })
  })

  describe('failures and the footer Back', () => {
    it('asks for a verified email on a 403', async () => {
      setup({ withoutMainAgent: [], withMainAgent: [] }, { 'POST /me/register': httpError(403, { code: 'EMAIL_NOT_VERIFIED' }) })

      expect(await screen.findByText(/Please verify your email address first/)).toBeInTheDocument()
    })

    it('shows a plain error otherwise', async () => {
      setup({ withoutMainAgent: [], withMainAgent: [] }, { 'POST /me/register': httpError(500) })

      expect(await screen.findByText('Something went wrong finding your players. Please try again later.')).toBeInTheDocument()
    })

    it('offers Back to players in the footer for a person who has players', async () => {
      const user = userEvent.setup()
      setup({ withoutMainAgent: [], withMainAgent: [] }, { 'GET /me/players': [{ key: 'k', firstName: 'A', lastName: 'B', photoUrl: null, clubId: 'c1', clubName: 'X', groupLabel: null, self: false, main: true }] })

      await user.click(await screen.findByRole('button', { name: 'Back to players' }))

      expect(await screen.findByTestId('location')).toHaveTextContent('/account')
    })

    it('offers Back to club in the footer for a manager with no players', async () => {
      const user = userEvent.setup()
      setup(
        { withoutMainAgent: [], withMainAgent: [] },
        { 'POST /me/activate': { personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: ['c1'] } },
      )

      // One in the header and one in the footer's Back slot.
      const buttons = await screen.findAllByRole('button', { name: 'Back to club' })
      expect(buttons).toHaveLength(2)
      await user.click(buttons[1])

      expect(await screen.findByTestId('location')).toHaveTextContent('/manage')
    })
  })
})
