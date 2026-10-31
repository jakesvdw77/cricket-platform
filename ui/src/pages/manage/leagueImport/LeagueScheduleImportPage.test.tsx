import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_CLUB_ID, SAMPLE_TYPE, sampleBatch } from '../../../components/ImportWizard/importFixtures'
import { installFakeImportApi } from '../../../components/ImportWizard/importFakes'
import type { FakeImportServer } from '../../../components/ImportWizard/importFakes'
import LeagueScheduleImportPage from './LeagueScheduleImportPage'

const mocks = vi.hoisted(() => ({ leagues: vi.fn(), seasons: vi.fn() }))
vi.mock('../../../api/leagueApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/leagueApi')>()), listLeagues: () => mocks.leagues() }))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: () => mocks.seasons() }))
vi.mock('../../../api/leagueTeamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/leagueTeamApi')>()), listLeagueTeams: () => Promise.resolve([]) }))

let server: FakeImportServer | null = null
afterEach(() => server?.restore())

function Elsewhere() {
  const location = useLocation()
  return <div data-testid="elsewhere">{location.pathname + location.search}</div>
}

function renderPage(url: string) {
  server = installFakeImportApi({ batch: sampleBatch(), types: [{ ...SAMPLE_TYPE, type: 'LEAGUE_SCHEDULE', label: 'League schedule' }] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route element={<Outlet context={{ clubId: SAMPLE_CLUB_ID }} />}>
            <Route path="/manage/fixtures/leagues/:leagueId/schedule/import" element={<LeagueScheduleImportPage />} />
          </Route>
          <Route path="*" element={<Elsewhere />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const league = { id: 'l1', name: 'Northern Premier League', active: true }
const season = { id: 's1', label: '2026/27' }

describe('LeagueScheduleImportPage', () => {
  it('opens the wizard on the upload step for the league and season, with the schedule wording', async () => {
    mocks.leagues.mockResolvedValue([league])
    mocks.seasons.mockResolvedValue([season])
    renderPage('/manage/fixtures/leagues/l1/schedule/import?seasonId=s1')
    expect(await screen.findByText(/Importing into: Northern Premier League, 2026\/27/, undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument()
    expect(await screen.findByText('Only matches involving our teams', undefined, { timeout: 10000 })).toBeInTheDocument()
  })

  // docs/specs/127-return-navigation.md: a returnTo in the address wins over the legacy ?from=.
  it('Back returns to the returnTo origin, ahead of the legacy ?from=view', async () => {
    mocks.leagues.mockResolvedValue([league])
    mocks.seasons.mockResolvedValue([season])
    const origin = '/manage/fixtures/leagues/l1/schedule?seasonId=s1&showAll=1'
    renderPage(`/manage/fixtures/leagues/l1/schedule/import?from=view&returnTo=${encodeURIComponent(origin)}&returnLabel=TVL%20schedule`)
    await userEvent.click(await screen.findByRole('button', { name: 'Back to the schedule' }, { timeout: 10000 }))
    expect(screen.getByTestId('elsewhere')).toHaveTextContent(origin)
  })

  it('without a returnTo, ?from=view still returns to the league Schedule', async () => {
    mocks.leagues.mockResolvedValue([league])
    mocks.seasons.mockResolvedValue([season])
    renderPage('/manage/fixtures/leagues/l1/schedule/import?from=view')
    await userEvent.click(await screen.findByRole('button', { name: 'Back to the schedule' }, { timeout: 10000 }))
    expect(screen.getByTestId('elsewhere')).toHaveTextContent('/manage/fixtures/leagues/l1/schedule')
  })

  it('asks for a season when none is given, and refuses an inactive league', async () => {
    mocks.leagues.mockResolvedValue([league])
    mocks.seasons.mockResolvedValue([season])
    renderPage('/manage/fixtures/leagues/l1/schedule/import')
    expect(await screen.findByText('Choose a season', undefined, { timeout: 10000 })).toBeInTheDocument()
    server?.restore()
    mocks.leagues.mockResolvedValue([{ ...league, active: false }])
    renderPage('/manage/fixtures/leagues/l1/schedule/import?seasonId=s1')
    expect(await screen.findByText('This league cannot take an import')).toBeInTheDocument()
  })
})
