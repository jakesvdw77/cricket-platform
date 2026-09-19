import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SeasonDetailPage from './SeasonDetailPage'
import type { Season } from '../../api/seasonApi'

const listSeasons = vi.fn()

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'test-club-id',
    label: '2026 Season',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="fixtures/seasons" element={<div>Season List Page</div>} />
            <Route path="fixtures/seasons/:seasonId" element={<SeasonDetailPage />} />
            <Route path="fixtures/seasons/:seasonId/edit" element={<div>Edit Season Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SeasonDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/fixtures/seasons/season-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSeasons).not.toHaveBeenCalled()
  })

  it('loads the matching season and renders its fields read-only, with an Edit action to the real edit route', async () => {
    listSeasons.mockResolvedValueOnce([
      makeSeason({ id: 'season-1', label: '2026 Season' }),
      makeSeason({ id: 'season-2', label: '2027 Season' }),
    ])

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: '2026 Season' })).toBeInTheDocument()
    expect(listSeasons).toHaveBeenCalledWith('test-club-id')
    expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    expect(screen.getByText('2026-12-31')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/manage/fixtures/seasons/season-1/edit',
    )
  })

  it('renders an error state when the matching season id is not in the fetched list', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'some-other-id' })])

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this season")).toBeInTheDocument()
  })
})
