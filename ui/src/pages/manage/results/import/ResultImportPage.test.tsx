import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { AxiosError } from 'axios'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resultsKey } from '../../../../api/matchResultApi'
import { baseTheme } from '../../../../theme'
import { jsonAdaptor, makeCatalogue, makePreview, makeResolved } from './importTestUtils'
import ResultImportPage from './ResultImportPage'

const getImportCatalogue = vi.fn()
const previewImport = vi.fn()
const resolveImport = vi.fn()

vi.mock('../../../../api/resultImportApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../api/resultImportApi')>()
  return {
    ...actual,
    getImportCatalogue: (clubId: string) => getImportCatalogue(clubId),
    previewImport: (clubId: string, request: unknown, file?: File | null) => previewImport(clubId, request, file),
    resolveImport: (clubId: string, request: unknown) => resolveImport(clubId, request),
  }
})
vi.mock('../../../../api/matchApi', () => ({ createMatch: () => Promise.resolve({}) }))
vi.mock('../../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([]) }))
vi.mock('../../../../api/seasonApi', () => ({ listSeasons: () => Promise.resolve([]) }))
vi.mock('../../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../../../api/leagueAffiliationApi', () => ({ listLeagueAffiliations: () => Promise.resolve([]) }))
vi.mock('../../../../api/leagueTeamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../../api/leagueTeamApi')>()), listLeagueTeams: () => Promise.resolve([]) }))
vi.mock('../../../../api/meApi', () => ({ activateSession: () => Promise.resolve({ personId: null, personStatus: null, platformAdmin: false, clubAdminClubIds: [] }) }))

function Where() {
  const location = useLocation()
  return <div data-testid="where">{location.pathname + location.search}</div>
}

function renderPage(clubId: string | undefined = 'club-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const removeQueries = vi.spyOn(queryClient, 'removeQueries')
  render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/manage/results/import']}>
          <Routes>
            <Route path="/manage" element={<Outlet context={{ clubId }} />}>
              <Route path="results/import" element={<ResultImportPage />} />
              <Route path="*" element={<Where />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { removeQueries }
}

const step = (n: number) => screen.getByRole('button', { name: new RegExp(`^Step ${n}:`) })

async function paste(user: ReturnType<typeof userEvent.setup>, text = '{"keep":"me"}') {
  await user.click(await screen.findByRole('tab', { name: 'Paste' }))
  const box = screen.getByLabelText('Pasted result content')
  await user.click(box)
  await user.paste(text)
  return box
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor]))
  previewImport.mockResolvedValue(makePreview())
  resolveImport.mockResolvedValue(makeResolved())
})

describe('ResultImportPage', () => {
  it('shows Not authorised and calls nothing when there is no club', () => {
    renderPage(null as unknown as undefined)
    expect(screen.getByText('Not authorised')).toBeInTheDocument()
    expect(getImportCatalogue).not.toHaveBeenCalled()
  })

  it('cannot advance without a valid source, a match or a complete mapping', async () => {
    previewImport.mockResolvedValue(
      makePreview({ teamMapping: [{ fileKey: 'a', fileName: 'Northgate Strollers', side: null, exactness: 'UNRESOLVED' }, { fileKey: 'b', fileName: 'Riverside Occasionals', side: null, exactness: 'UNRESOLVED' }] }),
    )
    const user = userEvent.setup()
    renderPage()

    // No input yet: Continue is disabled and a later step cannot be reached from the stepper.
    await user.click(await screen.findByRole('tab', { name: 'Paste' }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await user.click(step(2))
    await user.click(step(3))
    expect(screen.queryByText('Which match is this?')).not.toBeInTheDocument()
    expect(previewImport).not.toHaveBeenCalled()

    await paste(user, '{}')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Which match is this?')

    // Forward steps are never clickable from the stepper, only the step's own button moves on.
    await user.click(step(3))
    expect(screen.queryByText('Which side is which?')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Which side is which?')
    expect(screen.getByRole('button', { name: 'Create draft and review' })).toBeDisabled()
    expect(resolveImport).not.toHaveBeenCalled()

    // Back is allowed.
    await user.click(step(1))
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('on success clears the cached results and opens the capture page flagged as imported', async () => {
    const user = userEvent.setup()
    const { removeQueries } = renderPage()
    await paste(user, '{}')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Which match is this?')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Which side is which?')
    await user.click(screen.getByRole('button', { name: 'Create draft and review' }))
    await user.click(await screen.findByRole('button', { name: 'Review in the result wizard' }))

    expect(removeQueries).toHaveBeenCalledWith({ queryKey: resultsKey('club-1') })
    expect(await screen.findByTestId('where')).toHaveTextContent('/manage/results/match-1/capture?imported=1')
  })

  it('keeps the pasted input and shows the problem alert when resolving fails', async () => {
    resolveImport.mockRejectedValue(new AxiosError('failed', '409', undefined, undefined, { status: 409, data: { detail: 'A published result already exists.' } } as never))
    const user = userEvent.setup()
    renderPage()
    await paste(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Which match is this?')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Which side is which?')
    await user.click(screen.getByRole('button', { name: 'Create draft and review' }))

    expect(await screen.findByTestId('import-problem')).toHaveTextContent('A published result already exists.')
    expect(screen.getByRole('button', { name: 'Create draft and review' })).toBeEnabled()
    expect(screen.queryByTestId('where')).not.toBeInTheDocument()

    // Going back to the Source step, the pasted text is still there.
    await user.click(step(1))
    await waitFor(() => expect(screen.getByLabelText('Pasted result content')).toHaveValue('{"keep":"me"}'))
  })
})
