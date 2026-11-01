import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FieldsPage from './FieldsPage'
import { fieldPage, makeField } from '../../../test/fieldFixtures'

const listPlayingAreas = vi.fn()
const getPlayingAreasSummary = vi.fn()
const listPlayingAreaFilterOptions = vi.fn()
const linkPlayingAreaHome = vi.fn()
const unlinkPlayingAreaHome = vi.fn()

vi.mock('../../../api/playingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/playingAreaApi')>()
  return {
    ...actual,
    listPlayingAreas: (clubId: string, params: unknown) => listPlayingAreas(clubId, params),
    getPlayingAreasSummary: (clubId: string, filters: unknown) => getPlayingAreasSummary(clubId, filters),
    listPlayingAreaFilterOptions: (clubId: string, params: unknown) => listPlayingAreaFilterOptions(clubId, params),
    linkPlayingAreaHome: (clubId: string, id: string) => linkPlayingAreaHome(clubId, id),
    unlinkPlayingAreaHome: (clubId: string, id: string) => unlinkPlayingAreaHome(clubId, id),
  }
})

const OURS = makeField({ id: 'own-1', name: 'Riverside Oval', linkedHome: true })
const OTHER = makeField({ id: 'other-1', name: 'Hilton College Oval' })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  listPlayingAreas.mockResolvedValue(fieldPage([OURS]))
  getPlayingAreasSummary.mockResolvedValue({ ourFields: 2, inDirectory: 14, unverified: 3 })
  listPlayingAreaFilterOptions.mockResolvedValue({ countries: ['ZA', 'GB'], provinces: ['KwaZulu-Natal'], cities: ['Hilton'] })
  linkPlayingAreaHome.mockResolvedValue(undefined)
  unlinkPlayingAreaHome.mockResolvedValue(undefined)
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="at">{location.pathname + location.search}</div>
}

function renderPage(clubId: string | undefined = 'club-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/fixtures/fields']}>
        <Routes>
          <Route element={<Outlet context={{ clubId }} />}>
            <Route path="/manage/fixtures/fields" element={<FieldsPage />} />
            <Route path="/manage/fixtures/fields/new" element={<div>Add field page</div>} />
            <Route path="/manage/fixtures/fields/:fieldId" element={<LocationProbe />} />
            <Route path="/manage/fixtures/fields/:fieldId/edit" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const lastListParams = () => listPlayingAreas.mock.calls[listPlayingAreas.mock.calls.length - 1][1] as Record<string, unknown>
const ownChip = () => screen.getByRole('button', { name: 'Our Fields Only' })
const openMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => user.click(await screen.findByRole('button', { name: `Actions for ${name}` }))

// docs/specs/099-fields-directory.md (1) and docs/specs/134
describe('FieldsPage', () => {
  it('shows the header with Add Field, which opens the add page carrying the list as its origin', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Fields' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(await screen.findByText('Add field page')).toBeInTheDocument()
  })

  it('has no count text, no Quick filter row and no icon on the Add Field button', async () => {
    renderPage()

    await screen.findByText('Riverside Oval')
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Quick filter/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Field' }).querySelector('svg')).toBeNull()
  })

  it('shows the three counters from the summary, including the Our Fields count', async () => {
    renderPage()

    await screen.findByText('Riverside Oval')
    expect(await screen.findByText('Our Fields', { selector: ':not(label *)' })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByTestId('page-counter-unverified')).toHaveTextContent('3')
    expect(screen.getByText('In The Directory')).toBeInTheDocument()
    expect(getPlayingAreasSummary).toHaveBeenCalledWith('club-1', {})
  })

  it('hides the counters, but still lists, when the summary fails', async () => {
    getPlayingAreasSummary.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText('Riverside Oval')).toBeInTheDocument()
    expect(screen.queryByTestId('page-counter-unverified')).not.toBeInTheDocument()
  })

  describe('Our Fields Only', () => {
    it('defaults on, and asks for mine=true, when the club has fields of its own', async () => {
      renderPage()

      await screen.findByText('Riverside Oval')
      expect(ownChip()).toHaveAttribute('aria-pressed', 'true')
      expect(lastListParams()).toMatchObject({ page: 0, mine: true })
    })

    it('waits for the first summary: it never lists the whole directory before it knows', async () => {
      renderPage()

      await screen.findByText('Riverside Oval')
      for (const [, params] of listPlayingAreas.mock.calls) expect((params as { mine?: boolean }).mine).toBe(true)
    })

    it('defaults off, listing the whole directory, when the club has none', async () => {
      getPlayingAreasSummary.mockResolvedValue({ ourFields: 0, inDirectory: 14, unverified: 3 })
      renderPage()

      await screen.findByText('Riverside Oval')
      expect(ownChip()).toHaveAttribute('aria-pressed', 'false')
      expect(lastListParams().mine).toBeUndefined()
    })

    it('turning it off lists every club\'s fields, and the choice is remembered per club', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')

      await user.click(ownChip())

      await waitFor(() => expect(lastListParams().mine).toBeUndefined())
      expect(ownChip()).toHaveAttribute('aria-pressed', 'false')
      expect(JSON.parse(localStorage.getItem('fieldList:filters:club-1') as string)).toMatchObject({ ownOnly: false })
    })

    it('a saved choice wins over the automatic default', async () => {
      localStorage.setItem('fieldList:filters:club-1', JSON.stringify({ ownOnly: false }))
      renderPage()

      await screen.findByText('Riverside Oval')
      await waitFor(() => expect(ownChip()).toHaveAttribute('aria-pressed', 'false'))
      expect(lastListParams().mine).toBeUndefined()
    })
  })

  describe('filters are backend params', () => {
    it('sends the typed search, debounced, as q', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')
      listPlayingAreas.mockClear()

      await user.type(screen.getByPlaceholderText('Search by field name or city'), 'hilton')
      expect(listPlayingAreas).not.toHaveBeenCalled()

      await waitFor(() => expect(lastListParams()).toMatchObject({ q: 'hilton', page: 0 }), { timeout: 2000 })
      await waitFor(() => expect(getPlayingAreasSummary).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ q: 'hilton' })))
    })

    it('sends the chosen Type, and shapes the counters by it', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')

      await user.click(screen.getByLabelText('Type'))
      await user.click(await screen.findByRole('option', { name: 'School' }))

      await waitFor(() => expect(lastListParams()).toMatchObject({ category: 'SCHOOL' }))
      await waitFor(() => expect(getPlayingAreasSummary).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ category: 'SCHOOL' })))
    })

    it('offers the countries (by name), provinces and cities the server says are reachable, and sends the chosen ones', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')

      await user.click(screen.getByLabelText('Country'))
      expect(await screen.findByRole('option', { name: 'South Africa' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'United Kingdom' })).toBeInTheDocument()
      await user.click(screen.getByRole('option', { name: 'South Africa' }))
      await waitFor(() => expect(lastListParams()).toMatchObject({ country: 'ZA' }))

      await user.click(screen.getByLabelText('Province'))
      await user.click(await screen.findByRole('option', { name: 'KwaZulu-Natal' }))
      await waitFor(() => expect(lastListParams()).toMatchObject({ country: 'ZA', province: 'KwaZulu-Natal' }))

      await user.click(screen.getByLabelText('City'))
      await user.click(await screen.findByRole('option', { name: 'Hilton' }))
      await waitFor(() => expect(lastListParams()).toMatchObject({ city: 'Hilton' }))
      expect(listPlayingAreaFilterOptions).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ country: 'ZA', province: 'KwaZulu-Natal', city: 'Hilton' }))
    })

    it('clears Province and City when the Country changes', async () => {
      localStorage.setItem('fieldList:filters:club-1', JSON.stringify({ ownOnly: true, country: 'ZA', province: 'KwaZulu-Natal', city: 'Hilton' }))
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')
      await waitFor(() => expect(lastListParams()).toMatchObject({ province: 'KwaZulu-Natal', city: 'Hilton' }))

      await user.click(screen.getByLabelText('Country'))
      await user.click(await screen.findByRole('option', { name: 'United Kingdom' }))

      await waitFor(() => expect(lastListParams()).toMatchObject({ country: 'GB' }))
      expect(lastListParams().province).toBeUndefined()
      expect(lastListParams().city).toBeUndefined()
    })

    it('the Unverified counter is a quick filter sent as verification=UNVERIFIED, and toggles off again', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')

      await user.click(screen.getByTestId('page-counter-unverified'))
      await waitFor(() => expect(lastListParams()).toMatchObject({ verification: 'UNVERIFIED' }))
      expect(screen.getByTestId('page-counter-unverified')).toHaveAttribute('data-active', 'true')
      // the counters are not narrowed by the quick filter
      expect(getPlayingAreasSummary).toHaveBeenLastCalledWith('club-1', {})

      await user.click(screen.getByTestId('page-counter-unverified'))
      await waitFor(() => expect(lastListParams().verification).toBeUndefined())
    })

    it('Sort asks the server for Name, Z To A', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')

      await user.click(screen.getByRole('button', { name: 'Sort: Name, A To Z' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Name, Z To A' }))

      await waitFor(() => expect(lastListParams()).toMatchObject({ sort: 'name,desc' }))
    })

    it('saves Type, Country, Province, City and the switch per club, but not the search', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')
      await user.click(screen.getByLabelText('Type'))
      await user.click(await screen.findByRole('option', { name: 'Academy' }))
      await user.type(screen.getByPlaceholderText('Search by field name or city'), 'abc')

      await waitFor(() => expect(localStorage.getItem('fieldList:filters:club-1')).toContain('ACADEMY'))
      expect(localStorage.getItem('fieldList:filters:club-1')).not.toContain('abc')
    })
  })

  describe('cards and list', () => {
    it('shows cards by default and the table after switching to List, remembering the choice', async () => {
      const user = userEvent.setup()
      listPlayingAreas.mockResolvedValue(fieldPage([OURS, OTHER]))
      renderPage()

      await screen.findByRole('heading', { name: 'Riverside Oval' })
      expect(screen.queryByRole('table', { name: 'Fields' })).not.toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'List' })[0])

      expect(await screen.findByRole('table', { name: 'Fields' })).toBeInTheDocument()
      expect(localStorage.getItem('fieldList:view')).toBe('list')
    })

    it('Add To Our Fields in the kebab links the field for this club', async () => {
      const user = userEvent.setup()
      getPlayingAreasSummary.mockResolvedValue({ ourFields: 0, inDirectory: 5, unverified: 0 })
      listPlayingAreas.mockResolvedValue(fieldPage([OTHER]))
      renderPage()

      await openMenu(user, 'Hilton College Oval')
      await user.click(await screen.findByRole('menuitem', { name: 'Add To Our Fields' }))

      await waitFor(() => expect(linkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'other-1'))
    })

    it('Remove From Our Fields unlinks it', async () => {
      const user = userEvent.setup()
      renderPage()

      await openMenu(user, 'Riverside Oval')
      await user.click(await screen.findByRole('menuitem', { name: 'Remove From Our Fields' }))

      await waitFor(() => expect(unlinkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'own-1'))
    })

    it('says so when changing the link fails', async () => {
      const user = userEvent.setup()
      linkPlayingAreaHome.mockRejectedValue(new Error('nope'))
      getPlayingAreasSummary.mockResolvedValue({ ourFields: 0, inDirectory: 5, unverified: 0 })
      listPlayingAreas.mockResolvedValue(fieldPage([OTHER]))
      renderPage()

      await openMenu(user, 'Hilton College Oval')
      await user.click(await screen.findByRole('menuitem', { name: 'Add To Our Fields' }))

      expect(await screen.findByText("Couldn't change your fields")).toBeInTheDocument()
    })

    it('puts Sort and then Cards | List last in the toolbar, with the chip before them', async () => {
      renderPage()
      await screen.findByText('Riverside Oval')

      const chip = ownChip()
      const sort = screen.getByRole('button', { name: 'Sort: Name, A To Z' })
      const cards = screen.getByRole('button', { name: 'Cards' })
      const list = screen.getByRole('button', { name: 'List' })
      const order = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(order(chip, sort)).toBe(true)
      expect(order(sort, cards)).toBe(true)
      expect(order(cards, list)).toBe(true)
    })

    it('Cards view: a standalone toolbar card, flat cards with no footer bar, and a dashed Add Field card', async () => {
      renderPage()

      await screen.findByRole('heading', { name: 'Riverside Oval' })
      expect(screen.getByTestId('toolbar-card')).toHaveAttribute('data-composition', 'standalone')
      expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
      expect(screen.getByTestId('add-field-card')).toHaveTextContent('Add Field')
      expect(screen.getAllByRole('button', { name: /^Actions for / })).toHaveLength(1)
    })

    it('List view: the toolbar is fused into the table card, rows have one kebab each and no chevron', async () => {
      const user = userEvent.setup()
      localStorage.setItem('fieldList:view', 'list')
      listPlayingAreas.mockResolvedValue(fieldPage([OURS, OTHER]))
      renderPage()

      const table = await screen.findByRole('table', { name: 'Fields' })
      expect(screen.getByTestId('fields-fused-card')).toContainElement(table)
      expect(screen.getByTestId('toolbar-card-fused')).toBeInTheDocument()
      expect(screen.queryByTestId('toolbar-card')).not.toBeInTheDocument()
      expect(screen.queryByTestId('add-field-card')).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Actions for / })).toHaveLength(2)
      expect(screen.queryByTestId('ChevronRightIcon')).not.toBeInTheDocument()

      // the kebab never navigates its row
      await openMenu(user, 'Riverside Oval')
      expect(screen.queryByTestId('at')).not.toBeInTheDocument()
    })

    describe('the kebab', () => {
      it('lists Open Field, Edit Field, Open In Maps and the Our Fields choice, and no Share or status items', async () => {
        const user = userEvent.setup()
        listPlayingAreas.mockResolvedValue(fieldPage([makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1', linkedHome: true })]))
        renderPage()

        await openMenu(user, 'Riverside Oval')

        expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open Field', 'Edit Field', 'Open In Maps', 'Remove From Our Fields'])
      })

      it('keeps Edit Field disabled, with its reason, when the club cannot edit the field', async () => {
        const user = userEvent.setup()
        renderPage()

        await openMenu(user, 'Riverside Oval')

        const edit = await screen.findByRole('menuitem', { name: /Edit Field/ })
        expect(edit).toHaveAttribute('aria-disabled', 'true')
        expect(edit).toHaveTextContent('Only a platform admin can change a verified field.')
      })

      it('leaves out Open In Maps when the field has no map link', async () => {
        const user = userEvent.setup()
        listPlayingAreas.mockResolvedValue(fieldPage([makeField({ mapUrl: null })]))
        renderPage()

        await openMenu(user, 'Riverside Oval')

        expect(screen.queryByRole('menuitem', { name: /Open In Maps/ })).not.toBeInTheDocument()
      })

      it('Open Field and Edit Field carry the list as returnTo', async () => {
        const user = userEvent.setup()
        listPlayingAreas.mockResolvedValue(fieldPage([makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' })]))
        renderPage()

        await openMenu(user, 'Riverside Oval')
        expect(await screen.findByRole('menuitem', { name: 'Open Field' })).toHaveAttribute(
          'href',
          '/manage/fixtures/fields/field-1?returnTo=%2Fmanage%2Ffixtures%2Ffields&returnLabel=Fields',
        )
        expect(screen.getByRole('menuitem', { name: 'Edit Field' })).toHaveAttribute(
          'href',
          '/manage/fixtures/fields/field-1/edit?returnTo=%2Fmanage%2Ffixtures%2Ffields&returnLabel=Fields',
        )
      })
    })
  })

  describe('paging is done by the backend', () => {
    it('shows Page 1 of 3, asks for the next page on Next and the previous on Previous', async () => {
      const user = userEvent.setup()
      listPlayingAreas.mockImplementation((_club, params: { page: number }) =>
        Promise.resolve(fieldPage([makeField({ id: `f${params.page}`, name: `Field page ${params.page}` })], { totalElements: 45, totalPages: 3, number: params.page })),
      )
      renderPage()

      expect(await screen.findByText('Field page 0')).toBeInTheDocument()
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Next' }))
      expect(await screen.findByText('Field page 1')).toBeInTheDocument()
      expect(lastListParams()).toMatchObject({ page: 1 })
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Previous' }))
      expect(await screen.findByText('Field page 0')).toBeInTheDocument()
    })

    it('goes back to the first page when a filter changes', async () => {
      const user = userEvent.setup()
      listPlayingAreas.mockImplementation((_club, params: { page: number }) =>
        Promise.resolve(fieldPage([makeField({ id: `f${params.page}`, name: `Field page ${params.page}` })], { totalElements: 45, totalPages: 3, number: params.page })),
      )
      renderPage()
      await screen.findByText('Field page 0')
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await screen.findByText('Field page 1')

      await user.click(screen.getByLabelText('Type'))
      await user.click(await screen.findByRole('option', { name: 'Club' }))

      await waitFor(() => expect(lastListParams()).toMatchObject({ page: 0, category: 'CLUB' }))
    })

    it('shows no pager for a single page, and never slices the list in the browser', async () => {
      const many = Array.from({ length: 25 }, (_, i) => makeField({ id: `f${i}`, name: `Field ${i}` }))
      listPlayingAreas.mockResolvedValue(fieldPage(many, { totalElements: 25, totalPages: 1 }))
      renderPage()

      await screen.findByText('Field 24')
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(25)
      expect(screen.queryByText(/^Page /)).not.toBeInTheDocument()
    })
  })

  describe('empty and error states', () => {
    it('says the club has no fields of its own yet when Our Fields Only finds none, with no button in the message', async () => {
      listPlayingAreas.mockResolvedValue(fieldPage([]))
      renderPage()
      const title = await screen.findByText('No fields of your own yet')
      expect(title).toBeInTheDocument()
      expect(within(title.parentElement as HTMLElement).queryByRole('button')).not.toBeInTheDocument()
      // the dashed Add Field card is the way in
      expect(screen.getByTestId('add-field-card')).toBeInTheDocument()
    })

    it('says nothing matches a search', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')
      listPlayingAreas.mockResolvedValue(fieldPage([]))

      await user.type(screen.getByPlaceholderText('Search by field name or city'), 'zzz')

      expect(await screen.findByText('No matching fields')).toBeInTheDocument()
    })

    it('says nothing is waiting under the Unverified quick filter', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')
      listPlayingAreas.mockResolvedValue(fieldPage([]))

      await user.click(screen.getByTestId('page-counter-unverified'))

      expect(await screen.findByText('Nothing to check')).toBeInTheDocument()
    })

    it('shows an error when the list cannot be loaded', async () => {
      listPlayingAreas.mockRejectedValue(new Error('boom'))
      renderPage()
      expect(await screen.findByText("Couldn't load fields")).toBeInTheDocument()
    })

    it('shows Not authorized without a club', () => {
      renderPage('')
      expect(screen.getByText('Not authorized')).toBeInTheDocument()
      expect(listPlayingAreas).not.toHaveBeenCalled()
    })
  })

  it('the whole card opens the field: the title is a link to its page carrying the list as returnTo', async () => {
    renderPage()
    const heading = await screen.findByRole('heading', { name: 'Riverside Oval' })
    expect(within(heading).getByRole('link')).toHaveAttribute(
      'href',
      '/manage/fixtures/fields/own-1?returnTo=%2Fmanage%2Ffixtures%2Ffields&returnLabel=Fields',
    )
  })
})
