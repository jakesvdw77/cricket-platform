import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { FieldDto } from '../../../api/myPlayersApi'
import { HubFields } from './HubFields'
import { calls, httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/121 (Field Directory, Decisions 6, 19, 21): read-only cards, client-side search, the server's 200 cap.
const http = api as unknown as ApiMock

const field = (overrides: Partial<FieldDto> = {}): FieldDto => ({
  id: 'f1', name: 'Riverside Oval', owner: 'City Council', addressLine1: '1 Main Rd', city: 'Paarl', provinceState: 'Western Cape',
  postalCode: '7646', country: 'ZA', mapUrl: 'https://maps.example/riverside', verified: true, home: true, ...overrides,
})
const FIELDS = [
  field(),
  field({ id: 'f2', name: 'Hillcrest Park', owner: null, addressLine1: '9 Hill St', city: 'Hilton', mapUrl: null, verified: false, home: false }),
]

function renderFields(list: FieldDto[] | Error, playerKey = 'k1') {
  routeApi(http, { 'GET /me/players/k1/fields': list, 'GET /me/players/k2/fields': [field({ id: 'g1', name: 'Other Club Ground' })] })
  const client = newQueryClient()
  const wrap = (key: string): ReactNode => (
    <QueryClientProvider client={client}>
      <HubFields playerKey={key} />
    </QueryClientProvider>
  )
  const view = render(wrap(playerKey))
  return { ...view, switchTo: (key: string) => view.rerender(wrap(key)) }
}

const cards = () => screen.getAllByTestId('hub-field-card')
const card = (name: string) => cards().find((c) => within(c).queryByRole('heading', { name })) as HTMLElement

beforeEach(() => vi.clearAllMocks())

describe('HubFields', () => {
  it('shows one card per field with name, address and the Home and Address checked tags', async () => {
    renderFields(FIELDS)

    expect(await screen.findByRole('heading', { name: 'Field Directory' })).toBeInTheDocument()
    await screen.findByRole('heading', { name: 'Riverside Oval' })
    expect(cards()).toHaveLength(2)
    const home = card('Riverside Oval')
    expect(within(home).getByText('1 Main Rd, Paarl, Western Cape, 7646, South Africa')).toBeInTheDocument()
    expect(within(home).getByText('Home field')).toBeInTheDocument()
    expect(within(home).getByText('Address checked')).toBeInTheDocument()
    const away = card('Hillcrest Park')
    expect(within(away).getByText('Away this season')).toBeInTheDocument()
    expect(within(away).getByText('Address not checked yet')).toBeInTheDocument()
    expect(within(away).queryByText('Home field')).not.toBeInTheDocument()
  })

  it('shows the owner only when there is one', async () => {
    renderFields(FIELDS)
    await screen.findByRole('heading', { name: 'Riverside Oval' })

    expect(within(card('Riverside Oval')).getByText('Owner: City Council')).toBeInTheDocument()
    expect(within(card('Hillcrest Park')).queryByText(/Owner:/)).not.toBeInTheDocument()
  })

  it('offers Directions only for an https map URL, opening in a new tab', async () => {
    renderFields([
      ...FIELDS,
      field({ id: 'f3', name: 'Script Ground', mapUrl: 'javascript:alert(1)' }),
      field({ id: 'f4', name: 'Data Ground', mapUrl: 'data:text/html,hi' }),
      field({ id: 'f5', name: 'Plain Ground', mapUrl: 'http://maps.example/plain' }),
    ])
    await screen.findByRole('heading', { name: 'Riverside Oval' })

    const link = within(card('Riverside Oval')).getByRole('link', { name: 'Directions to Riverside Oval' })
    expect(link).toHaveAttribute('href', 'https://maps.example/riverside')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getAllByRole('link')).toHaveLength(1)
    for (const name of ['Hillcrest Park', 'Script Ground', 'Data Ground', 'Plain Ground']) expect(within(card(name)).queryByRole('link')).not.toBeInTheDocument()
  })

  it('searches name, address and owner, case-insensitively, and says so when nothing matches', async () => {
    const user = userEvent.setup()
    renderFields(FIELDS)
    await screen.findByRole('heading', { name: 'Riverside Oval' })
    const box = screen.getByRole('textbox', { name: 'Search fields' })

    await user.type(box, 'HILLCREST')
    expect(cards()).toHaveLength(1)
    await user.clear(box)
    await user.type(box, 'hilton')
    expect(cards().map((c) => within(c).getByRole('heading').textContent)).toEqual(['Hillcrest Park'])
    await user.clear(box)
    await user.type(box, 'council')
    expect(cards().map((c) => within(c).getByRole('heading').textContent)).toEqual(['Riverside Oval'])
    await user.clear(box)
    await user.type(box, 'zzz')
    expect(screen.queryByTestId('hub-field-card')).not.toBeInTheDocument()
    expect(screen.getByText('No fields match your search.')).toBeInTheDocument()
  })

  it('Escape in the search clears the text first and is left for the page only when the box is empty', async () => {
    const user = userEvent.setup()
    renderFields(FIELDS)
    await screen.findByRole('heading', { name: 'Riverside Oval' })
    const box = screen.getByRole('textbox', { name: 'Search fields' })
    const seen: boolean[] = []
    const listener = (event: KeyboardEvent) => seen.push(event.defaultPrevented)
    window.addEventListener('keydown', listener)

    await user.type(box, 'oval')
    await user.keyboard('{Escape}')
    expect(box).toHaveValue('')
    expect(seen.at(-1)).toBe(true)
    await user.keyboard('{Escape}')
    expect(seen.at(-1)).toBe(false)
    expect(box).toHaveAttribute('data-hub-escape')
    window.removeEventListener('keydown', listener)
  })

  it('shows a skeleton while loading', async () => {
    http.get.mockImplementation(() => new Promise(() => undefined))
    const { container } = render(
      <QueryClientProvider client={newQueryClient()}>
        <HubFields playerKey="k1" />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(4))
    expect(screen.queryByTestId('hub-field-card')).not.toBeInTheDocument()
  })

  it('shows an error with Retry that loads the list again', async () => {
    const user = userEvent.setup()
    renderFields(httpError(500))
    expect(await screen.findByText('We could not load the fields. Please try again.')).toBeInTheDocument()

    routeApi(http, { 'GET /me/players/k1/fields': FIELDS })
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: 'Riverside Oval' })).toBeInTheDocument()
    expect(screen.queryByText('We could not load the fields. Please try again.')).not.toBeInTheDocument()
  })

  it('shows the empty state when the club has no fields', async () => {
    renderFields([])
    expect(await screen.findByText(/No fields yet\. Fields appear here once your club adds them/)).toBeInTheDocument()
    expect(screen.queryByText('No fields match your search.')).not.toBeInTheDocument()
  })

  it('always shows the away-fields note, and the 200 note only at exactly 200', async () => {
    const first = renderFields(FIELDS)
    await screen.findByRole('heading', { name: 'Riverside Oval' })
    expect(screen.getByText('Away fields appear once your club links a field to a match.')).toBeInTheDocument()
    expect(screen.queryByText('Showing the first 200 fields.')).not.toBeInTheDocument()
    first.unmount()

    const many = (n: number) => Array.from({ length: n }, (_, i) => field({ id: `m${i}`, name: `Ground ${i}` }))
    const at199 = renderFields(many(199))
    await screen.findByRole('heading', { name: 'Ground 0' })
    expect(screen.queryByText('Showing the first 200 fields.')).not.toBeInTheDocument()
    at199.unmount()

    renderFields(many(200))
    expect(await screen.findByText('Showing the first 200 fields.')).toBeInTheDocument()
    expect(screen.getByText('Away fields appear once your club links a field to a match.')).toBeInTheDocument()
  })

  it('shows the note on an empty list too', async () => {
    renderFields([])
    await screen.findByText(/No fields yet/)
    expect(screen.getByText('Away fields appear once your club links a field to a match.')).toBeInTheDocument()
  })

  it('loads again, and clears the search, when the player changes', async () => {
    const user = userEvent.setup()
    const view = renderFields(FIELDS)
    await screen.findByRole('heading', { name: 'Riverside Oval' })
    await user.type(screen.getByRole('textbox', { name: 'Search fields' }), 'oval')

    view.switchTo('k2')

    expect(await screen.findByRole('heading', { name: 'Other Club Ground' })).toBeInTheDocument()
    expect(calls(http.get, '/me/players/k2/fields')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Riverside Oval' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search fields' })).toHaveValue('')
  })
})
