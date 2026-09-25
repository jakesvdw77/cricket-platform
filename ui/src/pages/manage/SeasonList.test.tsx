import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SeasonList from './SeasonList'
import type { Season } from '../../api/seasonApi'

const listSeasons = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern. No deactivate/
// reactivate assertions here — docs/specs/038-move-deactivate-to-edit-screen.md relocated that
// control off this card entirely, onto SeasonFormPage's own actions bar.
vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
  deactivateSeason: vi.fn(),
  reactivateSeason: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'test-club-id',
    label: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// SeasonList reads clubId via useOutletContext, not useParams (normally threaded through by
// ManagerHome's own <Outlet context={{ clubId }} />) — same wrapper-route shape as
// SponsorList.test.tsx, reproduced here without pulling ManagerHome in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/fixtures/seasons']}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="seasons" element={<SeasonList />} />
            <Route path="seasons/new" element={<div>Add Season Page</div>} />
            <Route path="seasons/:id/edit" element={<div>Edit Season Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SeasonList', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSeasons).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listSeasons.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No seasons yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listSeasons.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load seasons")).toBeInTheDocument()
  })

  it('renders the "No seasons yet" empty state when the club has no seasons', async () => {
    listSeasons.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No seasons yet')).toBeInTheDocument()
  })

  // docs/specs/056-club-profile-overview.md: the back link now returns to Club Profile rather
  // than the old /manage/fixtures hub.
  it('renders a "Back to Club Profile" link pointing at /manage/club-profile', async () => {
    listSeasons.mockResolvedValueOnce([])

    renderList('test-club-id')

    await screen.findByText('No seasons yet')
    expect(screen.getByRole('link', { name: 'Back to Club Profile' })).toHaveAttribute(
      'href',
      '/manage/club-profile',
    )
  })

  it('renders a card per season with its fields and an Inactive badge for a deactivated one', async () => {
    listSeasons.mockResolvedValueOnce([
      makeSeason({ id: 'season-1', label: '2026' }),
      makeSeason({ id: 'season-2', label: '2025', active: false }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('2026')).toBeInTheDocument()
    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against label)', async () => {
    listSeasons.mockResolvedValueOnce([
      makeSeason({ id: 'season-1', label: '2026' }),
      makeSeason({ id: 'season-2', label: '2025' }),
    ])

    renderList('test-club-id')

    await screen.findByText('2026')
    expect(screen.getByText('2025')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '2026' } })

    expect(await screen.findByText('2026')).toBeInTheDocument()
    expect(screen.queryByText('2025')).not.toBeInTheDocument()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: the Sort Select was replaced by a compact icon
  // toggle — this exercises the previously-dead `direction === 'desc'` branch for real, not just
  // visually.
  it('clicking the sort icon reverses the card order, and flips its own accessible name', async () => {
    const user = userEvent.setup()
    listSeasons.mockResolvedValueOnce([
      makeSeason({ id: 'season-1', label: '2025' }),
      makeSeason({ id: 'season-2', label: '2026' }),
    ])

    renderList('test-club-id')

    await screen.findByText('2025')
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual(['2025', '2026'])

    await user.click(screen.getByRole('button', { name: 'Label, Z to A' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual(['2026', '2025'])
    expect(screen.getByRole('button', { name: 'Label, A to Z' })).toBeInTheDocument()
  })

  it('clicking Add Season navigates to the create route', async () => {
    const user = userEvent.setup()
    listSeasons.mockResolvedValueOnce([])

    renderList('test-club-id')

    await screen.findByText('No seasons yet')
    await user.click(screen.getByRole('button', { name: 'Add Season' }))

    expect(await screen.findByText('Add Season Page')).toBeInTheDocument()
  })

  // docs/specs/049-record-list-edit-action-rollout.md: mirrors MatchList.test.tsx's own
  // precedent test for the View+Edit dual-render footer.
  it('renders View and Edit together on a card, both pointing at the season\'s own routes', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])

    renderList('test-club-id')

    await screen.findByText('2026')
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/manage/fixtures/seasons/season-1',
    )
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/manage/fixtures/seasons/season-1/edit',
    )
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the list card at all — active or inactive — it moved to SeasonFormPage's own actions bar.
  it('never renders a Deactivate/Reactivate button on the card, active or inactive', async () => {
    listSeasons.mockResolvedValueOnce([
      makeSeason({ id: 'season-1', label: '2026', active: true }),
      makeSeason({ id: 'season-2', label: '2025', active: false }),
    ])

    renderList('test-club-id')

    await screen.findByText('2026')
    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })
})
