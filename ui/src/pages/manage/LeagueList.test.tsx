import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueList from './LeagueList'
import { LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { CARD_GRID_TEMPLATE_COLUMNS } from '../../utils/cardGrid'

const listLeagues = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern. No deactivate/
// reactivate assertions here — docs/specs/038-move-deactivate-to-edit-screen.md relocated that
// control off this card entirely, onto LeagueFormPage's own actions bar.
vi.mock('../../api/leagueApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/leagueApi')>()
  return {
    ...actual,
    listLeagues: (clubId: string) => listLeagues(clubId),
    deactivateLeague: vi.fn(),
    reactivateLeague: vi.fn(),
  }
})

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
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    currentSeasonTeamCount: 0,
    currentSeasonLabel: null,
    currentSeasonPlayingConditionsUrl: null,
    matchCount: 0,
    playedCount: 0,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: null,
    teams: [],
    format: null,
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
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
            <Route path="leagues/:id/schedule" element={<div>League Schedule Page</div>} />
            <Route path="leagues/:id/edit" element={<div>Edit League Page</div>} />
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

  // docs/specs/079-manager-shell-and-overview.md: the manager shell's menu replaces the back link.
  it('renders no back link (the shell menu replaces "Back to Dashboard")', async () => {
    listLeagues.mockResolvedValueOnce([])

    renderList('test-club-id')

    await screen.findByText('No leagues yet')
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument()
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

  // docs/specs/043-list-toolbar-gold-standard.md: the Sort Select was replaced by a compact icon
  // toggle — this exercises the previously-dead `direction === 'desc'` branch for real, not just
  // visually.
  it('clicking the sort icon reverses the card order, and flips its own accessible name', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValueOnce([
      makeLeague({ id: 'league-1', name: 'Alpha League' }),
      makeLeague({ id: 'league-2', name: 'Zeta League' }),
    ])

    renderList('test-club-id')

    await screen.findByText('Alpha League')
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Alpha League',
      'Zeta League',
    ])

    await user.click(screen.getByRole('button', { name: 'Name, Z to A' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Zeta League',
      'Alpha League',
    ])
    expect(screen.getByRole('button', { name: 'Name, A to Z' })).toBeInTheDocument()
  })

  it('clicking Add League navigates to the create route', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValueOnce([])

    renderList('test-club-id')

    await screen.findByText('No leagues yet')
    await user.click(screen.getByRole('button', { name: 'Add League' }))

    expect(await screen.findByText('Add League Page')).toBeInTheDocument()
  })

  // docs/specs/071-league-card-redesign.md: the title link and the footer buttons all route into the
  // 072 view pages; the card's own behaviour is covered in leagues/LeagueCard.test.tsx.
  it('links the card title to the league Schedule and opens the edit screen from the footer', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', name: 'Internal League' })])

    const { unmount } = renderList('test-club-id')
    await screen.findByText('Internal League')
    expect(screen.getByRole('link', { name: 'Internal League' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1/schedule',
    )
    await user.click(screen.getByRole('link', { name: 'Internal League' }))
    expect(await screen.findByText('League Schedule Page')).toBeInTheDocument()
    unmount()

    renderList('test-club-id')
    await screen.findByText('Internal League')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(await screen.findByText('Edit League Page')).toBeInTheDocument()
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

  describe('card grid', () => {
    it('lays the cards out with the shared cardGridSx template', async () => {
      listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' }), makeLeague({ id: 'league-2', name: 'Other' })])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      const grid = screen.getAllByRole('heading', { level: 3 })[0].closest('.MuiCard-root')?.parentElement as HTMLElement
      expect(grid).toHaveStyle({ display: 'grid', alignItems: 'stretch' })
      expect(grid).toHaveStyle({ gridTemplateColumns: CARD_GRID_TEMPLATE_COLUMNS })
    })
  })

  describe('Format filter', () => {
    const FILTER_KEY = 'leagueList:filters:test-club-id'

    async function openFormatMenu(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('combobox', { name: 'Format' }))
      return screen.getByRole('listbox')
    }

    beforeEach(() => {
      localStorage.clear()
    })

    it('lists "All formats" followed by every format in label order', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValueOnce([makeLeague()])

      renderList('test-club-id')
      await screen.findByText('Internal League')

      const listbox = await openFormatMenu(user)
      expect(within(listbox).getAllByRole('option').map((el) => el.textContent)).toEqual([
        'All formats',
        ...Object.values(LEAGUE_FORMAT_LABELS),
      ])
    })

    it('filters the cards client-side by the chosen format, and All formats clears it', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValueOnce([
        makeLeague({ id: 'league-1', name: 'Twenty Over League', format: 'T20' }),
        makeLeague({ id: 'league-2', name: 'Day League', format: 'ONE_DAY' }),
        makeLeague({ id: 'league-3', name: 'Unformatted League', format: null }),
      ])

      renderList('test-club-id')
      await screen.findByText('Twenty Over League')

      await user.click(within(await openFormatMenu(user)).getByRole('option', { name: LEAGUE_FORMAT_LABELS.T20 }))

      expect(screen.getByText('Twenty Over League')).toBeInTheDocument()
      expect(screen.queryByText('Day League')).not.toBeInTheDocument()
      expect(screen.queryByText('Unformatted League')).not.toBeInTheDocument()
      expect(listLeagues).toHaveBeenCalledTimes(1)

      await user.click(within(await openFormatMenu(user)).getByRole('option', { name: 'All formats' }))
      expect(screen.getByText('Day League')).toBeInTheDocument()
      expect(screen.getByText('Unformatted League')).toBeInTheDocument()
    })

    it('combines with the name search', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValueOnce([
        makeLeague({ id: 'league-1', name: 'Alpha T20', format: 'T20' }),
        makeLeague({ id: 'league-2', name: 'Beta T20', format: 'T20' }),
        makeLeague({ id: 'league-3', name: 'Alpha Day', format: 'ONE_DAY' }),
      ])

      renderList('test-club-id')
      await screen.findByText('Alpha T20')

      await user.click(within(await openFormatMenu(user)).getByRole('option', { name: LEAGUE_FORMAT_LABELS.T20 }))
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'alpha' } })

      expect(await screen.findByText('Alpha T20')).toBeInTheDocument()
      expect(screen.queryByText('Beta T20')).not.toBeInTheDocument()
      expect(screen.queryByText('Alpha Day')).not.toBeInTheDocument()
    })

    it('persists the choice per club and restores it after a remount', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([
        makeLeague({ id: 'league-1', name: 'Twenty Over League', format: 'T20' }),
        makeLeague({ id: 'league-2', name: 'Day League', format: 'ONE_DAY' }),
      ])

      const { unmount } = renderList('test-club-id')
      await screen.findByText('Twenty Over League')
      await user.click(within(await openFormatMenu(user)).getByRole('option', { name: LEAGUE_FORMAT_LABELS.T20 }))

      expect(JSON.parse(localStorage.getItem(FILTER_KEY) as string)).toEqual({ format: 'T20' })
      unmount()

      renderList('test-club-id')
      expect(await screen.findByText('Twenty Over League')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Day League')).not.toBeInTheDocument())
    })

    it('does not apply another club\'s persisted format', async () => {
      localStorage.setItem('leagueList:filters:other-club', JSON.stringify({ format: 'T20' }))
      listLeagues.mockResolvedValueOnce([
        makeLeague({ id: 'league-1', name: 'Twenty Over League', format: 'T20' }),
        makeLeague({ id: 'league-2', name: 'Day League', format: 'ONE_DAY' }),
      ])

      renderList('test-club-id')

      expect(await screen.findByText('Day League')).toBeInTheDocument()
      expect(screen.getByText('Twenty Over League')).toBeInTheDocument()
    })

    it('falls back to All formats when the stored value is corrupt', async () => {
      localStorage.setItem(FILTER_KEY, '{not json')
      listLeagues.mockResolvedValueOnce([
        makeLeague({ id: 'league-1', name: 'Twenty Over League', format: 'T20' }),
        makeLeague({ id: 'league-2', name: 'Day League', format: 'ONE_DAY' }),
      ])

      renderList('test-club-id')

      expect(await screen.findByText('Day League')).toBeInTheDocument()
      expect(screen.getByText('Twenty Over League')).toBeInTheDocument()
    })
  })

  describe('empty states', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('shows "No matching leagues" for a search with no result, without a format mention', async () => {
      listLeagues.mockResolvedValueOnce([makeLeague()])

      renderList('test-club-id')
      await screen.findByText('Internal League')
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

      expect(await screen.findByText('No matching leagues')).toBeInTheDocument()
      expect(screen.getByText('No leagues match "zzz". Try a different search.')).toBeInTheDocument()
    })

    it('mentions the format when a persisted format matches nothing, and All formats clears it', async () => {
      const user = userEvent.setup()
      localStorage.setItem('leagueList:filters:test-club-id', JSON.stringify({ format: 'FIVE_DAY' }))
      listLeagues.mockResolvedValueOnce([makeLeague({ format: 'T20' })])

      renderList('test-club-id')

      expect(await screen.findByText('No matching leagues')).toBeInTheDocument()
      expect(
        screen.getByText(`No ${LEAGUE_FORMAT_LABELS.FIVE_DAY} leagues found. Choose All formats to see every league.`),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('combobox', { name: 'Format' }))
      await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'All formats' }))

      expect(await screen.findByText('Internal League')).toBeInTheDocument()
      expect(screen.queryByText('No matching leagues')).not.toBeInTheDocument()
    })

    it('shows "No leagues yet" for a club with no leagues even with a persisted format', async () => {
      localStorage.setItem('leagueList:filters:test-club-id', JSON.stringify({ format: 'T20' }))
      listLeagues.mockResolvedValueOnce([])

      renderList('test-club-id')

      expect(await screen.findByText('No leagues yet')).toBeInTheDocument()
      expect(screen.queryByText('No matching leagues')).not.toBeInTheDocument()
    })

    it('shows "No leagues yet" for a club with no leagues even with a typed search', async () => {
      listLeagues.mockResolvedValueOnce([])

      renderList('test-club-id')
      await screen.findByText('No leagues yet')
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'abc' } })

      expect(screen.getByText('No leagues yet')).toBeInTheDocument()
      expect(screen.queryByText('No matching leagues')).not.toBeInTheDocument()
    })

    it('mentions both format and search when both are active', async () => {
      localStorage.setItem('leagueList:filters:test-club-id', JSON.stringify({ format: 'T20' }))
      listLeagues.mockResolvedValueOnce([makeLeague({ format: 'T20' })])

      renderList('test-club-id')
      await screen.findByText('Internal League')
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

      expect(
        await screen.findByText(
          `No ${LEAGUE_FORMAT_LABELS.T20} leagues match "zzz". Try a different search or choose All formats.`,
        ),
      ).toBeInTheDocument()
    })
  })

  describe('card contents', () => {
    it('renders the new card body for a league: season badges, progress and teams', async () => {
      listLeagues.mockResolvedValueOnce([
        makeLeague({
          currentSeasonLabel: '2026/2027',
          format: 'T20',
          matchCount: 4,
          playedCount: 1,
          teams: [
            { name: 'Riverside 1st XI', abbreviation: 'R1', logoUrl: null, own: true },
            { name: 'Hawks', abbreviation: null, logoUrl: null, own: false },
          ],
        }),
      ])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      const card = screen.getByRole('heading', { level: 3 }).closest('.MuiCard-root') as HTMLElement
      expect(within(card).getByText('2 teams')).toBeInTheDocument()
      expect(within(card).getByText('2026/2027')).toBeInTheDocument()
      expect(within(card).getByText('T20')).toBeInTheDocument()
      expect(within(card).getByText('1 of 4')).toBeInTheDocument()
      expect(within(card).getAllByRole('listitem')).toHaveLength(2)
    })
  })
})
