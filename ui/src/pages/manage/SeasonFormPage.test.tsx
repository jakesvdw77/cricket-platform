import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SeasonFormPage from './SeasonFormPage'
import type { Season } from '../../api/seasonApi'

const listSeasons = vi.fn()
const createSeason = vi.fn()
const updateSeason = vi.fn()
const deactivateSeason = vi.fn()
const reactivateSeason = vi.fn()

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
  createSeason: (clubId: string, payload: unknown) => createSeason(clubId, payload),
  updateSeason: (clubId: string, seasonId: string, payload: unknown) => updateSeason(clubId, seasonId, payload),
  deactivateSeason: (clubId: string, seasonId: string) => deactivateSeason(clubId, seasonId),
  reactivateSeason: (clubId: string, seasonId: string) => reactivateSeason(clubId, seasonId),
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

// Same wrapper-route shape as SponsorFormPage.test.tsx, reproducing ManagerHome's Outlet context
// without pulling ManagerHome itself in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="seasons" element={<div>Season List Page</div>} />
            <Route path="seasons/new" element={<SeasonFormPage />} />
            <Route path="seasons/:seasonId/edit" element={<SeasonFormPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SeasonFormPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/fixtures/seasons/new', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSeasons).not.toHaveBeenCalled()
  })

  it('create mode: renders the form with no fetch, and submit calls createSeason then navigates to the list', async () => {
    const user = userEvent.setup()
    createSeason.mockResolvedValueOnce(makeSeason())

    renderPage('/manage/fixtures/seasons/new', 'test-club-id')

    expect(screen.getByText('Add Season')).toBeInTheDocument()
    expect(listSeasons).not.toHaveBeenCalled()
    // docs/specs/038-move-deactivate-to-edit-screen.md: never rendered on a brand-new, not-yet-
    // saved record.
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Label'), '2026')
    await user.type(screen.getByLabelText('Start date'), '2026-01-01')
    await user.type(screen.getByLabelText('End date'), '2026-12-31')
    await user.click(screen.getByRole('button', { name: 'Create season' }))

    expect(createSeason).toHaveBeenCalledTimes(1)
    const [clubId, payload] = createSeason.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(payload).toMatchObject({ label: '2026' })

    expect(await screen.findByText('Season List Page')).toBeInTheDocument()
  })

  it('edit mode: fetches the full list and prefills from the matching season id', async () => {
    listSeasons.mockResolvedValueOnce([
      makeSeason({ id: 'season-1', label: '2026' }),
      makeSeason({ id: 'season-2', label: '2025' }),
    ])

    renderPage('/manage/fixtures/seasons/season-2/edit', 'test-club-id')

    expect(await screen.findByText('Edit Season')).toBeInTheDocument()
    expect(listSeasons).toHaveBeenCalledWith('test-club-id')
    expect(await screen.findByDisplayValue('2025')).toBeInTheDocument()
  })

  it('edit mode: renders an error state when the matching season id is not in the fetched list', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'some-other-id' })])

    renderPage('/manage/fixtures/seasons/season-2/edit', 'test-club-id')

    expect(await screen.findByText("Couldn't load this season")).toBeInTheDocument()
  })

  it('edit mode: submit calls updateSeason with the outlet clubId and route season id, then navigates to the list', async () => {
    const user = userEvent.setup()
    listSeasons.mockResolvedValue([makeSeason({ id: 'season-1', label: '2026' })])
    updateSeason.mockResolvedValueOnce(makeSeason({ id: 'season-1', label: '2026 Renamed' }))

    renderPage('/manage/fixtures/seasons/season-1/edit', 'test-club-id')

    await screen.findByText('Edit Season')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateSeason).toHaveBeenCalledTimes(1)
    const [clubId, seasonId, payload] = updateSeason.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(seasonId).toBe('season-1')
    expect(payload).toMatchObject({ label: '2026' })

    expect(await screen.findByText('Season List Page')).toBeInTheDocument()
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated from SeasonList's own card.
  describe('Deactivate/Reactivate', () => {
    it('edit mode: renders Deactivate for an active season, clicking it calls deactivateSeason and invalidates the seasons list', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1', active: true })])
      // onSuccess invalidates the list query while this page's own useQuery is still mounted,
      // triggering a refetch that must resolve to the now-inactive record for the button to
      // relabel.
      listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1', active: false })])
      let resolveDeactivate: (value: Season) => void = () => {}
      deactivateSeason.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDeactivate = resolve
        }),
      )

      renderPage('/manage/fixtures/seasons/season-1/edit', 'test-club-id')

      await screen.findByText('Edit Season')
      await user.click(screen.getByRole('button', { name: 'Deactivate' }))

      expect(deactivateSeason).toHaveBeenCalledWith('test-club-id', 'season-1')
      expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

      resolveDeactivate(makeSeason({ id: 'season-1', active: false }))

      expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    })

    it('edit mode: renders Reactivate for an inactive season, clicking it calls reactivateSeason', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValue([makeSeason({ id: 'season-1', active: false })])
      reactivateSeason.mockResolvedValueOnce(makeSeason({ id: 'season-1', active: true }))

      renderPage('/manage/fixtures/seasons/season-1/edit', 'test-club-id')

      await screen.findByText('Edit Season')
      await user.click(screen.getByRole('button', { name: 'Reactivate' }))

      expect(reactivateSeason).toHaveBeenCalledWith('test-club-id', 'season-1')
    })
  })
})
