import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../api/axiosConfig'
import { HubClubDirectory } from './HubClubDirectory'
import { calls, httpError, renderRoutes, routeApi } from '../../../../test/accountTestUtils'
import type { ApiMock } from '../../../../test/accountTestUtils'
import { makeContact, makeContactPage } from '../../../../test/clubInfoFixtures'
import type { MyClubDirectory } from '../../../../api/meClubInfoApi'

vi.mock('../../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
const copyToClipboard = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../../../utils/copyToClipboard', () => ({ copyToClipboard }))

// docs/specs/148 Contacts: the server sorts, filters and pages; the browser draws, never slices, and never exports.
const http = api as unknown as ApiMock
const URL = '/me/players/k1/club-info/contacts'
const BOTH: MyClubDirectory = { total: 3, phoneShown: true, emailShown: true }

const khan = makeContact({ id: 'c1', firstName: 'Ayesha', lastName: 'Khan', role: 'Chairperson', primary: true })
const naidoo = makeContact({ id: 'c2', firstName: 'Ben', lastName: 'Naidoo', role: 'Treasurer', phone: '083 555 0102', email: 'ben@example.com' })
const noRole = makeContact({ id: 'c3', firstName: 'Cara', lastName: 'Zulu', role: null, phone: null, email: null })

function show(handler: unknown = makeContactPage([khan, naidoo, noRole]), directory: MyClubDirectory | null = BOTH) {
  routeApi(http, { [`GET ${URL}`]: handler })
  return renderRoutes('/d', <Route path="/d" element={<HubClubDirectory playerKey="k1" directory={directory} />} />)
}
const lastParams = () => (http.get.mock.calls.filter((call) => call[0] === URL).at(-1)?.[1] as { params: Record<string, unknown> }).params
const rows = () => screen.getAllByTestId('club-contact-row')

beforeEach(() => {
  vi.clearAllMocks()
  copyToClipboard.mockResolvedValue(true)
})

describe('HubClubDirectory request', () => {
  it('asks for the first server page sorted by name, with no query or letter', async () => {
    show()

    await screen.findAllByTestId('club-contact-row')
    expect(lastParams()).toEqual({ sort: 'name', page: 0, size: 25 })
  })

  it('sends the typed text as query after a pause, trimmed', async () => {
    const user = userEvent.setup()
    show()
    await screen.findAllByTestId('club-contact-row')

    await user.type(screen.getByRole('textbox', { name: 'Search Contacts' }), ' ben ')
    await waitFor(() => expect(lastParams()).toMatchObject({ query: 'ben' }))
    // Each keystroke does not ask: only the settled text was ever sent.
    const sent = calls(http.get, URL).map((call) => (call[1] as { params: { query?: string } }).params.query)
    expect(sent.every((query) => query === undefined || query === 'ben')).toBe(true)
  })

  it('sends sort=role from the By Role toggle and sort=name from A To Z', async () => {
    const user = userEvent.setup()
    show()
    await screen.findAllByTestId('club-contact-row')

    await user.click(screen.getByRole('button', { name: 'By Role' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'role' }))
    await user.click(screen.getByRole('button', { name: 'A To Z' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'name' }))
  })

  it('does not ask at all when the directory is off', async () => {
    show(makeContactPage([khan]), null)

    await waitFor(() => expect(screen.getByTestId('hub-club-directory')).toBeInTheDocument())
    expect(calls(http.get, URL)).toHaveLength(0)
  })
})

describe('HubClubDirectory letters', () => {
  it('shows the letters of the response and sends the tapped one, and a second tap clears it', async () => {
    const user = userEvent.setup()
    show(makeContactPage([khan, naidoo], { letters: ['K', 'N'] }))
    await screen.findAllByTestId('club-contact-row')

    expect(screen.getAllByRole('button', { name: 'K' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'N' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Z' })).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'N' })[0])
    await waitFor(() => expect(lastParams()).toMatchObject({ letter: 'N' }))
    expect(screen.getAllByRole('button', { name: 'N' })[0]).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getAllByRole('button', { name: 'N' })[0])
    await waitFor(() => expect(lastParams().letter).toBeUndefined())
  })

  it('has no letter strip when ordered by role', async () => {
    const user = userEvent.setup()
    show(makeContactPage([khan], { letters: ['K'] }))
    await screen.findAllByTestId('club-contact-row')

    await user.click(screen.getByRole('button', { name: 'By Role' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'K' })).not.toBeInTheDocument())
  })
})

describe('HubClubDirectory rows', () => {
  it('draws the phone and email columns only when the club-info read says they are shown', async () => {
    const { unmount } = show(makeContactPage([khan]), { total: 1, phoneShown: true, emailShown: false })
    await screen.findAllByTestId('club-contact-row')
    expect(screen.getByRole('link', { name: 'Call' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Email' })).not.toBeInTheDocument()
    expect(screen.queryByText('ayesha@example.com')).not.toBeInTheDocument()
    unmount()

    show(makeContactPage([khan]), { total: 1, phoneShown: false, emailShown: true })
    await screen.findAllByTestId('club-contact-row')
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument()
    expect(screen.getByText('ayesha@example.com')).toBeInTheDocument()
    expect(screen.queryByText('082 555 0101')).not.toBeInTheDocument()
  })

  it('makes Call a tel: link and Email a mailto: link', async () => {
    show(makeContactPage([khan]))
    await screen.findAllByTestId('club-contact-row')

    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:0825550101')
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:ayesha@example.com')
  })

  it('says Not shared for a null value in a drawn column, and offers no Call, Email or Copy for it', async () => {
    show(makeContactPage([noRole]))
    await screen.findAllByTestId('club-contact-row')

    expect(screen.getAllByText('Not shared')).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Copy/ })).not.toBeInTheDocument()
  })

  it('tags the primary contact Main Contact and shows the role', async () => {
    show(makeContactPage([khan, naidoo]))
    await screen.findAllByTestId('club-contact-row')

    const [first, second] = rows()
    expect(within(first).getByText('Main Contact')).toBeInTheDocument()
    expect(within(first).getByText('Chairperson')).toBeInTheDocument()
    expect(within(second).queryByText('Main Contact')).not.toBeInTheDocument()
  })

  it('copies exactly one value per tap and announces it politely', async () => {
    const user = userEvent.setup()
    show(makeContactPage([khan]))
    await screen.findAllByTestId('club-contact-row')

    await user.click(screen.getByRole('button', { name: 'Copy number' }))
    expect(copyToClipboard).toHaveBeenCalledTimes(1)
    expect(copyToClipboard).toHaveBeenLastCalledWith('082 555 0101')
    const status = await screen.findByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Number copied')

    await user.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(copyToClipboard).toHaveBeenCalledTimes(2)
    expect(copyToClipboard).toHaveBeenLastCalledWith('ayesha@example.com')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Address copied'))
  })

  it('says so when the copy fails', async () => {
    const user = userEvent.setup()
    copyToClipboard.mockResolvedValue(false)
    show(makeContactPage([khan]))
    await screen.findAllByTestId('club-contact-row')

    await user.click(screen.getByRole('button', { name: 'Copy number' }))
    expect(await screen.findByText('Could not copy. Please copy it by hand.')).toBeInTheDocument()
  })
})

describe('HubClubDirectory grouping', () => {
  it('groups by the first letter of the last name when A To Z', async () => {
    show()
    await screen.findAllByTestId('club-contact-row')

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['K', 'N', 'Z'])
  })

  it('groups by role, with Other for a contact with no role', async () => {
    const user = userEvent.setup()
    show()
    await screen.findAllByTestId('club-contact-row')

    await user.click(screen.getByRole('button', { name: 'By Role' }))
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Chairperson', 'Treasurer', 'Other']))
  })
})

describe('HubClubDirectory paging', () => {
  it('asks the server for the next page on Show More and appends it', async () => {
    const user = userEvent.setup()
    show(({ config }: { config?: { params?: Record<string, unknown> } }) =>
      config?.params?.page === 1
        ? makeContactPage([noRole], { page: 1, hasMore: false, total: 3 })
        : makeContactPage([khan, naidoo], { page: 0, hasMore: true, total: 3 }),
    )
    await screen.findAllByTestId('club-contact-row')
    expect(rows()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Show More' }))
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(lastParams()).toMatchObject({ page: 1, size: 25 })
    expect(screen.queryByRole('button', { name: 'Show More' })).not.toBeInTheDocument()
  })

  it('has no Show More on the last page', async () => {
    show(makeContactPage([khan], { hasMore: false }))
    await screen.findAllByTestId('club-contact-row')

    expect(screen.queryByRole('button', { name: 'Show More' })).not.toBeInTheDocument()
  })
})

describe('HubClubDirectory empty and error states', () => {
  it('says No Contacts Yet when the club has none and nothing is searched', async () => {
    show(makeContactPage([]))

    const empty = await screen.findByTestId('club-contacts-empty')
    expect(empty).toHaveTextContent('No Contacts Yet')
    expect(empty).not.toHaveTextContent(/none yet/i)
  })

  it('shows the same friendly state for a 404 from the contacts read', async () => {
    show(httpError(404))

    expect(await screen.findByText('No Contacts Yet')).toBeInTheDocument()
    expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument()
  })

  it('says No Contacts Match for a search with no result, and Clear Search empties the box', async () => {
    const user = userEvent.setup()
    show(({ config }: { config?: { params?: Record<string, unknown> } }) => (config?.params?.query ? makeContactPage([], { letters: [] }) : makeContactPage([khan])))
    await screen.findAllByTestId('club-contact-row')

    await user.type(screen.getByRole('textbox', { name: 'Search Contacts' }), 'zzz')
    expect(await screen.findByText('No Contacts Match')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear Search' }))
    expect(screen.getByRole('textbox', { name: 'Search Contacts' })).toHaveValue('')
    expect(await screen.findAllByTestId('club-contact-row')).toHaveLength(1)
  })

  it('shows an error with Retry for a server failure', async () => {
    show(httpError(500))

    expect(await screen.findByText('We could not load the contacts. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
