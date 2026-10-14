import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResultList from './ResultList'
import { makeListItem, makeMatch, makePage, makeResult } from './resultTestUtils'

const listResults = vi.fn()
const getResultsSummary = vi.fn()
const listResultFilterOptions = vi.fn()
const listAwaitingResults = vi.fn()
const validateResult = vi.fn()
const publishResult = vi.fn()
const listTeamsForClub = vi.fn()

vi.mock('../../../api/matchResultApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchResultApi')>()
  return {
    ...actual,
    listResults: (clubId: string, params: unknown) => listResults(clubId, params),
    getResultsSummary: (clubId: string, filters: unknown) => getResultsSummary(clubId, filters),
    listResultFilterOptions: (clubId: string, filters: unknown) => listResultFilterOptions(clubId, filters),
    listAwaitingResults: (clubId: string, params: unknown) => listAwaitingResults(clubId, params),
    validateResult: (clubId: string, matchId: string) => validateResult(clubId, matchId),
    publishResult: (clubId: string, matchId: string, ack: boolean) => publishResult(clubId, matchId, ack),
  }
})
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: (clubId: string) => listTeamsForClub(clubId) }))
vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: () => Promise.resolve([]) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([]) }))

const SUMMARY = { played: 12, won: 7, lost: 3, tiedOrNone: 2, drafts: 1, awaiting: 4 }

function Where() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/results']}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="results" element={<ResultList />} />
            <Route path="results/*" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const published = makeListItem({ id: 'match-1' })
const draft = makeListItem({ id: 'match-2', awayTeamName: 'Hillcrest CC' }, { id: 'result-2', matchId: 'match-2', status: 'DRAFT', publishedAt: null })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  listTeamsForClub.mockResolvedValue([{ id: 'team-1', name: '1st XI' }])
  listResultFilterOptions.mockResolvedValue({ sectionIds: [], leagueIds: [], seasonIds: [], teamIds: ['team-1'] })
  getResultsSummary.mockResolvedValue(SUMMARY)
  listResults.mockResolvedValue(makePage([published, draft]))
  listAwaitingResults.mockResolvedValue(makePage([makeMatch({ id: 'match-9' })]))
})

describe('ResultList', () => {
  it('shows the six counters from the summary', async () => {
    renderPage()

    const value = (id: string) => within(screen.getByTestId(`page-counter-${id}`)).getByTestId('page-counter-value')
    await screen.findByTestId('page-counter-played')
    expect(value('played')).toHaveTextContent('12')
    expect(value('won')).toHaveTextContent('7')
    expect(value('lost')).toHaveTextContent('3')
    expect(value('tied-or-none')).toHaveTextContent('2')
    expect(value('drafts')).toHaveTextContent('1')
    expect(value('awaiting')).toHaveTextContent('4')
  })

  it('narrows the list to a counter, and turns the filter off when the same counter is chosen again', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('page-counter-drafts')

    await user.click(screen.getByTestId('page-counter-drafts'))
    await waitFor(() => expect(listResults).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ focus: 'drafts', page: 0 })))
    expect(screen.getByTestId('page-counter-drafts')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByTestId('page-counter-drafts'))
    await waitFor(() => expect(listResults).toHaveBeenLastCalledWith('club-1', expect.not.objectContaining({ focus: expect.anything() })))
  })

  it('sends the team filter and the debounced search to the list and the counters', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('page-counter-played')

    await user.type(screen.getByLabelText('Search'), 'Hillcrest')

    await waitFor(() => expect(listResults).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ search: 'Hillcrest' })))
    expect(getResultsSummary).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ search: 'Hillcrest' }))
  })

  it('renders a card per result with a Draft badge only on the draft', async () => {
    renderPage()

    const cards = await screen.findAllByRole('heading', { name: /vs/ })
    expect(cards).toHaveLength(2)
    expect(screen.getAllByText('Draft')).toHaveLength(1)
    expect(screen.getAllByText(/Showing 2 results/).length).toBeGreaterThan(0)
  })

  it('remembers the List view and shows a table row per result', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await screen.findByTestId('page-counter-played')

    await user.click(screen.getAllByRole('button', { name: 'List' })[0])

    expect(await screen.findAllByTestId('result-row')).toHaveLength(2)
    expect(localStorage.getItem('resultList:view')).toBe('list')
    unmount()

    renderPage()
    expect(await screen.findAllByTestId('result-row')).toHaveLength(2)
  })

  it('shows the first-run empty state with the awaiting count and a Capture result action', async () => {
    listResults.mockResolvedValue(makePage([]))
    renderPage()

    expect(await screen.findByText('No results yet')).toBeInTheDocument()
    expect(screen.getByText('4 matches are waiting for a result.')).toBeInTheDocument()
  })

  it('says nothing is waiting when there are no awaiting matches', async () => {
    listResults.mockResolvedValue(makePage([]))
    getResultsSummary.mockResolvedValue({ ...SUMMARY, awaiting: 0 })
    renderPage()

    expect(await screen.findByText('Results you capture for your matches will appear here.')).toBeInTheDocument()
  })

  it('shows the filtered empty state, not the first-run one, when a counter filter yields nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('page-counter-lost')
    listResults.mockResolvedValue(makePage([]))

    await user.click(screen.getByTestId('page-counter-lost'))

    expect(await screen.findByText('No results match these filters')).toBeInTheDocument()
    expect(screen.queryByText('No results yet')).not.toBeInTheDocument()
  })

  it('opens the capture picker from the Awaiting counter without filtering the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('page-counter-awaiting')
    listResults.mockClear()

    await user.click(screen.getByTestId('page-counter-awaiting'))

    expect(await screen.findByText('Capture a result')).toBeInTheDocument()
    await waitFor(() => expect(listAwaitingResults).toHaveBeenCalled())
    expect(listResults).not.toHaveBeenCalled()
  })

  describe('publish from a card', () => {
    const publishDraft = async (user: ReturnType<typeof userEvent.setup>) => {
      await screen.findAllByRole('heading', { name: /vs/ })
      // Only the draft has a Publish button.
      expect(screen.getAllByRole('button', { name: 'Publish' })).toHaveLength(1)
      await user.click(screen.getByRole('button', { name: 'Publish' }))
    }

    it('publishes a clean draft straight away, without acknowledging', async () => {
      const user = userEvent.setup()
      validateResult.mockResolvedValue({ canPublish: true, errors: [], warnings: [] })
      publishResult.mockResolvedValue(makeResult())
      renderPage()

      await publishDraft(user)

      await waitFor(() => expect(publishResult).toHaveBeenCalledWith('club-1', 'match-2', false))
      expect(validateResult).toHaveBeenCalledWith('club-1', 'match-2')
    })

    it('lists warnings and publishes only after "Publish anyway", acknowledging them', async () => {
      const user = userEvent.setup()
      validateResult.mockResolvedValue({ canPublish: true, errors: [], warnings: ['The toss and the batting order disagree.'] })
      publishResult.mockResolvedValue(makeResult())
      renderPage()

      await publishDraft(user)

      expect(await screen.findByText('Publish with warnings?')).toBeInTheDocument()
      expect(screen.getByText('The toss and the batting order disagree.')).toBeInTheDocument()
      expect(publishResult).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Publish anyway' }))
      await waitFor(() => expect(publishResult).toHaveBeenCalledWith('club-1', 'match-2', true))
    })

    it('lists the errors and never calls publish when the result is invalid', async () => {
      const user = userEvent.setup()
      validateResult.mockResolvedValue({ canPublish: false, errors: ['Choose who won.'], warnings: [] })
      renderPage()

      await publishDraft(user)

      expect(await screen.findByText("This result can't be published yet")).toBeInTheDocument()
      expect(screen.getByText('Choose who won.')).toBeInTheDocument()
      expect(publishResult).not.toHaveBeenCalled()
    })
  })

  it('opens the result page from a card title', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('link', { name: '1st XI vs Riverside Occasionals' }))

    expect(await screen.findByText('At: /manage/results/match-1')).toBeInTheDocument()
  })

  it('disables Edit with the unpublish reason on a published card and enables it on a draft', async () => {
    renderPage()
    await screen.findAllByRole('heading', { name: /vs/ })

    const edits = screen.getAllByRole('button', { name: 'Edit' })
    expect(edits.filter((button) => button.hasAttribute('disabled'))).toHaveLength(1)
    expect(screen.getAllByText('Unpublish to edit').length).toBeGreaterThan(0)
  })
})
