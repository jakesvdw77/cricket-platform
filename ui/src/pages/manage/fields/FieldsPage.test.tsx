import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
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

function renderPage(clubId: string | undefined = 'club-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/fixtures/fields']}>
        <Routes>
          <Route element={<Outlet context={{ clubId }} />}>
            <Route path="/manage/fixtures/fields" element={<FieldsPage />} />
            <Route path="/manage/fixtures/fields/new" element={<div>Add field page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const lastListParams = () => listPlayingAreas.mock.calls[listPlayingAreas.mock.calls.length - 1][1] as Record<string, unknown>
const ownSwitch = () => screen.getAllByRole('checkbox', { name: 'Show only our fields' })[0]

// docs/specs/099-fields-directory.md (1)
describe('FieldsPage', () => {
  it('shows the header with Add field, which opens the add page', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Fields' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add field' }))

    expect(await screen.findByText('Add field page')).toBeInTheDocument()
  })

  it('shows the three counters from the summary, including the Our fields count', async () => {
    renderPage()

    await screen.findByText('Riverside Oval')
    expect(await screen.findByText('Our fields', { selector: ':not(label *)' })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByTestId('page-counter-unverified')).toHaveTextContent('3')
    expect(screen.getByText('In the directory')).toBeInTheDocument()
    expect(getPlayingAreasSummary).toHaveBeenCalledWith('club-1', {})
  })

  it('hides the counters, but still lists, when the summary fails', async () => {
    getPlayingAreasSummary.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText('Riverside Oval')).toBeInTheDocument()
    expect(screen.queryByTestId('page-counter-unverified')).not.toBeInTheDocument()
  })

  describe('Show only our fields', () => {
    it('defaults on, and asks for mine=true, when the club has fields of its own', async () => {
      renderPage()

      await screen.findByText('Riverside Oval')
      expect(ownSwitch()).toBeChecked()
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
      expect(ownSwitch()).not.toBeChecked()
      expect(lastListParams().mine).toBeUndefined()
    })

    it('turning it off lists every club\'s fields, and the choice is remembered per club', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')

      await user.click(ownSwitch())

      await waitFor(() => expect(lastListParams().mine).toBeUndefined())
      expect(ownSwitch()).not.toBeChecked()
      expect(JSON.parse(localStorage.getItem('fieldList:filters:club-1') as string)).toMatchObject({ ownOnly: false })
    })

    it('a saved choice wins over the automatic default', async () => {
      localStorage.setItem('fieldList:filters:club-1', JSON.stringify({ ownOnly: false }))
      renderPage()

      await screen.findByText('Riverside Oval')
      await waitFor(() => expect(ownSwitch()).not.toBeChecked())
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

    it('the sort link asks the server for Z to A', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Riverside Oval')

      await user.click(screen.getAllByText('A to Z')[0])

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

    it('Add to our fields links the field for this club', async () => {
      const user = userEvent.setup()
      getPlayingAreasSummary.mockResolvedValue({ ourFields: 0, inDirectory: 5, unverified: 0 })
      listPlayingAreas.mockResolvedValue(fieldPage([OTHER]))
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Add to our fields' }))

      await waitFor(() => expect(linkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'other-1'))
    })

    it('Remove unlinks it', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Remove from our fields' }))

      await waitFor(() => expect(unlinkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'own-1'))
    })

    it('says so when changing the link fails', async () => {
      const user = userEvent.setup()
      linkPlayingAreaHome.mockRejectedValue(new Error('nope'))
      getPlayingAreasSummary.mockResolvedValue({ ourFields: 0, inDirectory: 5, unverified: 0 })
      listPlayingAreas.mockResolvedValue(fieldPage([OTHER]))
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Add to our fields' }))

      expect(await screen.findByText("Couldn't change your fields")).toBeInTheDocument()
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
    it('says the club has no fields of its own yet when "Show only our fields" finds none', async () => {
      listPlayingAreas.mockResolvedValue(fieldPage([]))
      renderPage()
      expect(await screen.findByText('No fields of your own yet')).toBeInTheDocument()
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

  it('the whole card opens the field: the title is a link to its page', async () => {
    renderPage()
    const heading = await screen.findByRole('heading', { name: 'Riverside Oval' })
    expect(within(heading).getByRole('link')).toHaveAttribute('href', '/manage/fixtures/fields/own-1')
  })
})
