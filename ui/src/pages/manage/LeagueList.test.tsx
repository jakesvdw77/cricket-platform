import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueList from './LeagueList'
import type { League } from '../../api/leagueApi'

const listLeagues = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern. No deactivate/
// reactivate assertions here — docs/specs/038-move-deactivate-to-edit-screen.md relocated that
// control off this card entirely, onto LeagueFormPage's own actions bar.
vi.mock('../../api/leagueApi', () => ({
  listLeagues: (clubId: string) => listLeagues(clubId),
  deactivateLeague: vi.fn(),
  reactivateLeague: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'test-club-id',
    name: 'Internal League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    allowSubstitutions: false,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// LeagueList reads clubId via useOutletContext, not useParams (normally threaded through by
// ManagerHome's own <Outlet context={{ clubId }} />) — same wrapper-route shape as
// SponsorList.test.tsx, reproduced here without pulling ManagerHome in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/fixtures/leagues']}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="leagues" element={<LeagueList />} />
            <Route path="leagues/new" element={<div>Add League Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeagueList', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listLeagues).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listLeagues.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No leagues yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listLeagues.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load leagues")).toBeInTheDocument()
  })

  it('renders the "No leagues yet" empty state when the club has no leagues', async () => {
    listLeagues.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No leagues yet')).toBeInTheDocument()
  })

  it('renders a card per league with its fields and an Inactive badge for a deactivated one', async () => {
    listLeagues.mockResolvedValueOnce([
      makeLeague({ id: 'league-1', name: 'Internal League' }),
      makeLeague({ id: 'league-2', name: 'Retired League', active: false }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('Internal League')).toBeInTheDocument()
    expect(screen.getByText('Retired League')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against name)', async () => {
    listLeagues.mockResolvedValueOnce([
      makeLeague({ id: 'league-1', name: 'Internal League' }),
      makeLeague({ id: 'league-2', name: 'External League' }),
    ])

    renderList('test-club-id')

    await screen.findByText('Internal League')
    expect(screen.getByText('External League')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'internal' } })

    expect(await screen.findByText('Internal League')).toBeInTheDocument()
    expect(screen.queryByText('External League')).not.toBeInTheDocument()
  })

  it('clicking Add League navigates to the create route', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValueOnce([])

    renderList('test-club-id')

    await screen.findByText('No leagues yet')
    await user.click(screen.getByRole('button', { name: 'Add League' }))

    expect(await screen.findByText('Add League Page')).toBeInTheDocument()
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the list card at all — active or inactive — it moved to LeagueFormPage's own actions bar.
  it('never renders a Deactivate/Reactivate button on the card, active or inactive', async () => {
    listLeagues.mockResolvedValueOnce([
      makeLeague({ id: 'league-1', name: 'Internal League', active: true }),
      makeLeague({ id: 'league-2', name: 'Retired League', active: false }),
    ])

    renderList('test-club-id')

    await screen.findByText('Internal League')
    expect(screen.getByText('Retired League')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })
})
