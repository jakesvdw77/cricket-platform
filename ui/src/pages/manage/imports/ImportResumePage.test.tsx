import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import { installFakeImportApi } from '../../../components/ImportWizard/importFakes'
import type { FakeImportServer } from '../../../components/ImportWizard/importFakes'
import { SAMPLE_CLUB_ID, SAMPLE_TYPE, committedBatch, sampleBatch } from '../../../components/ImportWizard/importFixtures'
import ImportResumePage from './ImportResumePage'

const mocks = vi.hoisted(() => ({ leagues: vi.fn(), seasons: vi.fn() }))
vi.mock('../../../api/leagueApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/leagueApi')>()), listLeagues: () => mocks.leagues() }))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: () => mocks.seasons() }))
vi.mock('../../../api/leagueTeamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/leagueTeamApi')>()), listLeagueTeams: () => Promise.resolve([]) }))

let server: FakeImportServer | null = null
const originalAdapter = api.defaults.adapter
afterEach(() => {
  server?.restore()
  api.defaults.adapter = originalAdapter
})

function renderResume(clubId: string | undefined = SAMPLE_CLUB_ID) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/manage/imports/batch-1']}>
        <Routes>
          <Route element={<Outlet context={{ clubId }} />}>
            <Route path="/manage/imports/:batchId" element={<ImportResumePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ImportResumePage', () => {
  it('says so when the account has no club', () => {
    renderResume('')
    expect(screen.getByText('Not authorised')).toBeInTheDocument()
  })

  it('offers a retry when the batch cannot be opened', async () => {
    server = installFakeImportApi()
    api.defaults.adapter = () => Promise.reject(new Error('gone'))
    renderResume()
    expect(await screen.findByText('We could not open this import', undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('opens a batch of an unregistered type in the generic wizard, named by the type label and file', async () => {
    server = installFakeImportApi({ batch: sampleBatch() })
    renderResume()
    expect(await screen.findByText(/Sample schedule, file schedule-2026\.xlsx/, undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText('Import: Sample schedule')).toBeInTheDocument()
  })

  it('opens a committed batch at its report', async () => {
    server = installFakeImportApi({ batch: committedBatch() })
    renderResume()
    expect(await screen.findByTestId('report-created-value', undefined, { timeout: 10000 })).toHaveTextContent('3')
  })

  it('opens a batch of a registered type with its own consumer wording and scope label', async () => {
    mocks.leagues.mockResolvedValue([{ id: 'league-1', name: 'Northern Premier League', active: true }])
    mocks.seasons.mockResolvedValue([{ id: 'season-1', label: '2026/27' }])
    server = installFakeImportApi({
      batch: sampleBatch({ type: 'LEAGUE_SCHEDULE' }),
      types: [{ ...SAMPLE_TYPE, type: 'LEAGUE_SCHEDULE', label: 'League schedule' }],
    })
    renderResume()
    expect(await screen.findByText(/Northern Premier League, 2026\/27/, undefined, { timeout: 10000 })).toBeInTheDocument()
    // The consumer's wording, not the generic one.
    expect(screen.queryByText(/Sample schedule, file/)).not.toBeInTheDocument()
  })
})
