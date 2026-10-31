import { TOOLBAR_CONTROL_HEIGHT, TOOLBAR_CONTROL_RADIUS } from '../../components/ToolbarCard/toolbarControlSx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueList from './LeagueList'
import { LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { DYNAMIC_CARD_GRID_TEMPLATE_COLUMNS } from '../../utils/cardGrid'

const listLeagues = vi.fn()
const getLeaguesSummary = vi.fn()
const listSeasons = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern. No deactivate/
// reactivate assertions here — docs/specs/038-move-deactivate-to-edit-screen.md relocated that
// control off this card entirely, onto LeagueFormPage's own actions bar.
vi.mock('../../api/leagueApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/leagueApi')>()
  return {
    ...actual,
    listLeagues: (clubId: string, params?: unknown) => listLeagues(clubId, params),
    getLeaguesSummary: (clubId: string, filters?: unknown) => getLeaguesSummary(clubId, filters),
    deactivateLeague: vi.fn(),
    reactivateLeague: vi.fn(),
  }
})

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

const SEASON_2026 = {
  id: 'season-2026',
  clubId: 'test-club-id',
  label: '2026/2027',
  startDate: '2000-01-01',
  endDate: '2999-12-31',
  active: true,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '',
  updatedBy: null,
}
const SEASON_2025 = { ...SEASON_2026, id: 'season-2025', label: '2025/2026', startDate: '1999-01-01', endDate: '1999-12-31', createdAt: '2025-02-01T00:00:00Z' }

const SUMMARY = { leaguesShown: 6, active: 5, teamsEntered: 42, players: 311, seasons: 4, matchesThisWeek: 9, needAttention: 2 }

const FILTER_KEY = 'leagueList:filters:test-club-id'

beforeEach(() => {
  // mockReset: a leftover mockResolvedValueOnce must not leak between tests
  for (const fn of [listLeagues, getLeaguesSummary, listSeasons]) fn.mockReset()
  localStorage.clear()
  listSeasons.mockResolvedValue([SEASON_2025, SEASON_2026])
  getLeaguesSummary.mockResolvedValue(SUMMARY)
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
    ageCutoffMonth: null,
    ageCutoffDay: null,
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

const lastListParams = () => listLeagues.mock.calls.at(-1)?.[1] as Record<string, unknown>

describe('LeagueList', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listLeagues).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listLeagues.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No league available')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('has no "Showing" line, no FILTER tag and no count text', async () => {
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-3', name: 'Table League' })])
    localStorage.setItem('leagueList:view', 'list')

    renderList('test-club-id')

    expect(await screen.findByRole('table', { name: 'Leagues' })).toBeInTheDocument()
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^filter$/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('leagues-count')).not.toBeInTheDocument()
    expect(screen.queryByText(/^1 leagues?$/)).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-bar-bare')).toBeInTheDocument()
    expect(within(screen.getByTestId('filter-bar-inline-controls')).getByRole('button', { name: 'List' })).toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listLeagues.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load leagues")).toBeInTheDocument()
  })

  it('renders the "No league available" empty state when the club has no leagues', async () => {
    listLeagues.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No league available')).toBeInTheDocument()
  })

  it('renders no back link (the shell menu replaces "Back to Dashboard")', async () => {
    listLeagues.mockResolvedValue([makeLeague()])

    renderList('test-club-id')

    await screen.findByText('Internal League')
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument()
  })

  it('clicking Add League navigates to the create route', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague()])

    renderList('test-club-id')

    await screen.findByText('Internal League')
    await user.click(screen.getByRole('button', { name: 'Add League' }))
    expect(await screen.findByText('Add League Page')).toBeInTheDocument()
  })

  describe('season pill (091)', () => {
    it('defaults to the season containing today with no All seasons row, and sends it with every request', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2026/2027')
      expect(lastListParams()).toEqual(expect.objectContaining({ seasonId: 'season-2026' }))
      expect(getLeaguesSummary).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ seasonId: 'season-2026' }))

      await user.click(screen.getByRole('button', { name: 'Season' }))
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['2025/2026', '2026/2027'])
    })

    it('re-requests the list and the counters for the chosen season and remembers it', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague()])

      const { unmount } = renderList('test-club-id')
      await screen.findByText('Internal League')
      await user.click(screen.getByRole('button', { name: 'Season' }))
      await user.click(screen.getByRole('option', { name: '2025/2026' }))

      await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ seasonId: 'season-2025' })))
      expect(getLeaguesSummary).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ seasonId: 'season-2025' }))
      expect(JSON.parse(localStorage.getItem(FILTER_KEY) as string)).toEqual({ format: '', seasonId: 'season-2025' })
      unmount()

      renderList('test-club-id')
      await waitFor(() => expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2025/2026'))
    })

    it('ignores a remembered season that is no longer one of the club\'s', async () => {
      localStorage.setItem(FILTER_KEY, JSON.stringify({ format: '', seasonId: 'gone' }))
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2026/2027')
    })
  })

  describe('counters (091)', () => {
    it('shows the six counters from the summary, three as quick filters and three as plain figures', async () => {
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(await screen.findByRole('button', { name: /Active leagues/ })).toHaveTextContent('5')
      expect(screen.getByRole('button', { name: /Matches this week/ })).toHaveTextContent('9')
      expect(screen.getByRole('button', { name: /Setup needed/ })).toHaveTextContent('2')
      expect(screen.getByText('Teams entered')).toBeInTheDocument()
      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText('Players')).toBeInTheDocument()
      expect(screen.getByText('311')).toBeInTheDocument()
      expect(screen.getByText('Seasons')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Teams entered/ })).not.toBeInTheDocument()
    })

    it('clicking a quick filter narrows the list through the server focus, clicking it again clears it, and only one is active', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      await user.click(await screen.findByRole('button', { name: /Setup needed/ }))
      await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ focus: 'attention' })))
      expect(screen.getByRole('button', { name: /Setup needed/ })).toHaveAttribute('aria-pressed', 'true')

      await user.click(screen.getByRole('button', { name: /Matches this week/ }))
      await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ focus: 'this-week' })))
      expect(screen.getByRole('button', { name: /Setup needed/ })).toHaveAttribute('aria-pressed', 'false')

      await user.click(screen.getByRole('button', { name: /Matches this week/ }))
      await waitFor(() => expect(lastListParams().focus).toBeUndefined())
    })

    it('hides the counters when the summary fails, the list still works', async () => {
      getLeaguesSummary.mockRejectedValue(new Error('boom'))
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      expect(await screen.findByText('Internal League')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('button', { name: /Active leagues/ })).not.toBeInTheDocument())
    })
  })

  describe('Show inactive (091)', () => {
    it('hides inactive leagues by default (the request sends includeInactive false) and the switch brings them back', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(lastListParams()).toEqual(expect.objectContaining({ includeInactive: false }))

      expect(screen.getByRole('button', { name: /show inactive/i })).toHaveAttribute('aria-pressed', 'false')
      await user.click(screen.getByRole('button', { name: /show inactive/i }))
      expect(screen.getByRole('button', { name: /show inactive/i })).toHaveAttribute('aria-pressed', 'true')
      await waitFor(() => expect(lastListParams().includeInactive).toBeUndefined())
      expect(getLeaguesSummary).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ includeInactive: undefined }))
    })
  })

  describe('cards', () => {
    it('renders a card per league with an Inactive badge for a deactivated one', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([
        makeLeague({ id: 'league-1', name: 'Active One' }),
        makeLeague({ id: 'league-2', name: 'Retired One', active: false }),
      ])

      renderList('test-club-id')

      await screen.findByText('Active One')
      await user.click(screen.getByRole('button', { name: /show inactive/i }))
      expect(await screen.findByText('Retired One')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('lays the cards out with the dynamic fill-the-width grid', async () => {
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      const heading = await screen.findByRole('heading', { name: 'Internal League' })
      const grid = heading.closest('.MuiCard-root')?.parentElement as HTMLElement
      expect(grid).toHaveStyle({ display: 'grid', gridTemplateColumns: DYNAMIC_CARD_GRID_TEMPLATE_COLUMNS, gap: '16px' })
    })

    it('links the card to the league Schedule for the chosen season and opens the edit screen from the Actions kebab', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-7' })])

      renderList('test-club-id')

      const titleLink = await screen.findByRole('link', { name: 'Internal League' })
      expect(titleLink).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/leagues/league-7/schedule?seasonId=season-2026'))
      await user.click(screen.getByRole('button', { name: 'Actions for Internal League' }))
      await user.click(screen.getByRole('menuitem', { name: 'Edit League Details' }))
      expect(await screen.findByText('Edit League Page')).toBeInTheDocument()
    })

    it('ends the cards grid with a dashed Add League card linking to the add route', async () => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'a', name: 'Alpha' }), makeLeague({ id: 'b', name: 'Beta' })])

      renderList('test-club-id')

      await screen.findByRole('heading', { name: 'Alpha' })
      const add = screen.getByTestId('add-league-card')
      // docs/specs/127: Add League returns to this list.
      expect(add).toHaveAttribute('href', '/manage/fixtures/leagues/new?returnTo=%2Fmanage%2Ffixtures%2Fleagues&returnLabel=Leagues')
      expect(add).toHaveTextContent('Add League')
      expect(add.parentElement?.lastElementChild).toBe(add)
    })

    it('shows the Add League card with the empty message when no card matches', async () => {
      listLeagues.mockResolvedValue([])

      renderList('test-club-id')

      expect(await screen.findByTestId('add-league-card')).toBeInTheDocument()
      expect(screen.getByText('No league available')).toBeInTheDocument()
    })

    it('never renders a Deactivate/Reactivate button on the card', async () => {
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(screen.queryByRole('button', { name: /deactivate|reactivate/i })).not.toBeInTheDocument()
    })
  })

  describe('toolbar', () => {
    it('filters by the search term (name) and sorts A to Z, reversible from the Sort menu', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([
        makeLeague({ id: 'league-1', name: 'Bravo League' }),
        makeLeague({ id: 'league-2', name: 'Alpha League' }),
      ])

      renderList('test-club-id')

      await screen.findByText('Bravo League')
      const names = () => screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
      expect(names()).toEqual(['Alpha League', 'Bravo League'])

      await user.click(screen.getByRole('button', { name: /sort: name, a to z/i }))
      await user.click(screen.getByRole('menuitem', { name: 'Name, Z to A' }))
      expect(names()).toEqual(['Bravo League', 'Alpha League'])

      await user.type(screen.getByLabelText('Search'), 'alpha')
      await waitFor(() => expect(screen.queryByText('Bravo League')).not.toBeInTheDocument())
      expect(screen.getByText('Alpha League')).toBeInTheDocument()
    })

    async function openFormatMenu(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByLabelText('Format'))
      return screen.getByRole('listbox')
    }

    it('lists "All formats" followed by every format in label order', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      const options = within(await openFormatMenu(user)).getAllByRole('option').map((option) => option.textContent)
      expect(options).toEqual(['All formats', ...Object.values(LEAGUE_FORMAT_LABELS)])
    })

    it('filters client-side by the chosen format, persists it per club and restores it after a remount', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([
        makeLeague({ id: 'league-1', name: 'Twenty Over League', format: 'T20' }),
        makeLeague({ id: 'league-2', name: 'Day League', format: 'ONE_DAY' }),
      ])

      const { unmount } = renderList('test-club-id')
      await screen.findByText('Twenty Over League')
      await user.click(within(await openFormatMenu(user)).getByRole('option', { name: LEAGUE_FORMAT_LABELS.T20 }))

      await waitFor(() => expect(screen.queryByText('Day League')).not.toBeInTheDocument())
      expect(JSON.parse(localStorage.getItem(FILTER_KEY) as string)).toEqual(expect.objectContaining({ format: 'T20' }))
      unmount()

      renderList('test-club-id')
      expect(await screen.findByText('Twenty Over League')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Day League')).not.toBeInTheDocument())
    })

    it('does not apply another club\'s persisted format, and falls back when the stored value is corrupt', async () => {
      localStorage.setItem('leagueList:filters:other-club', JSON.stringify({ format: 'T20' }))
      localStorage.setItem(FILTER_KEY, '{not json')
      listLeagues.mockResolvedValue([
        makeLeague({ id: 'league-1', name: 'Twenty Over League', format: 'T20' }),
        makeLeague({ id: 'league-2', name: 'Day League', format: 'ONE_DAY' }),
      ])

      renderList('test-club-id')

      expect(await screen.findByText('Day League')).toBeInTheDocument()
      expect(screen.getByText('Twenty Over League')).toBeInTheDocument()
    })
  })

  describe('list view (091)', () => {
    it('shows cards by default, switches to the table and back, and remembers the choice', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-3', name: 'Table League' })])

      const { unmount } = renderList('test-club-id')

      await screen.findByText('Table League')
      expect(screen.queryByRole('table', { name: 'Leagues' })).not.toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'List' })[0])
      const table = await screen.findByRole('table', { name: 'Leagues' })
      expect(within(table).getByRole('link', { name: 'Table League' })).toHaveAttribute(
        'href',
        expect.stringContaining('/manage/fixtures/leagues/league-3/schedule?seasonId=season-2026&returnTo=%2Fmanage%2Ffixtures%2Fleagues&returnLabel=Leagues'),
      )
      // docs/specs/127: a table row carries no chevron; the whole row is the link.
      expect(within(table).queryByTestId('ChevronRightOutlinedIcon')).not.toBeInTheDocument()
      expect(localStorage.getItem('leagueList:view')).toBe('list')
      unmount()

      renderList('test-club-id')
      expect(await screen.findByRole('table', { name: 'Leagues' })).toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'Cards' })[0])
      await waitFor(() => expect(screen.queryByRole('table', { name: 'Leagues' })).not.toBeInTheDocument())
    })
  })

  describe('toolbar card (page-anatomy section 3)', () => {
    it('List view fuses the toolbar into the table card: toolbar, then table', async () => {
      localStorage.setItem('leagueList:view', 'list')
      listLeagues.mockResolvedValue([makeLeague()])
      renderList('test-club-id')

      const card = await screen.findByTestId('leagues-fused-card')
      expect(within(card).getByTestId('toolbar-card-fused')).toContainElement(screen.getByLabelText('Search'))
      expect(within(card).getByRole('table', { name: 'Leagues' })).toBeInTheDocument()
      expect(screen.queryByTestId('toolbar-card')).not.toBeInTheDocument()
    })

    it('Cards view keeps a standalone toolbar card, also over its empty state', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague()])
      renderList('test-club-id')

      await screen.findByText('Internal League')
      const standalone = screen.getByTestId('toolbar-card')
      expect(standalone).toContainElement(screen.getByLabelText('Search'))
      expect(screen.queryByTestId('leagues-fused-card')).not.toBeInTheDocument()

      const input = screen.getByLabelText('Search')
      await user.type(input, 'zzz')
      expect(await screen.findByText('No matching leagues')).toBeInTheDocument()
      expect(screen.getByLabelText('Search')).toBe(input)
      expect(input).toHaveFocus()
      expect(screen.getByTestId('toolbar-card')).toContainElement(input)
    })

    it('List view keeps the fused card when nothing matches: the message replaces the rows and the search keeps focus', async () => {
      const user = userEvent.setup()
      localStorage.setItem('leagueList:view', 'list')
      listLeagues.mockResolvedValue([makeLeague({ name: 'Riverside League' })])
      renderList('test-club-id')

      await screen.findByRole('table', { name: 'Leagues' })
      const input = screen.getByLabelText('Search')
      await user.type(input, 'zzz')

      expect(await screen.findByText('No matching leagues')).toBeInTheDocument()
      const card = screen.getByTestId('leagues-fused-card')
      expect(within(card).getByText('No matching leagues')).toBeInTheDocument()
      expect(within(card).queryByRole('table', { name: 'Leagues' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('toolbar-card')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Search')).toBe(input)
      expect(document.activeElement).toBe(input)
      expect(input).toHaveValue('zzz')
    })

    it('every toolbar control (Format, search, Show inactive, Sort, Cards | List) shares the 36 px toolbar helper', async () => {
      listLeagues.mockResolvedValue([makeLeague()])
      renderList('test-club-id')
      await screen.findByText('Internal League')

    const toolbar = screen.getByTestId('toolbar-card')
    const fields = Array.from(toolbar.querySelectorAll('.MuiOutlinedInput-root'))
    expect(fields.length).toBeGreaterThan(0)
    for (const field of fields) expect(getComputedStyle(field).height).toBe(`${TOOLBAR_CONTROL_HEIGHT}px`)
    const controls = [...Array.from(toolbar.querySelectorAll('[role="group"]')), ...Array.from(toolbar.querySelectorAll('button[aria-haspopup="menu"], button[aria-pressed]:not(.MuiToggleButton-root)'))]
    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) {
      const style = getComputedStyle(control)
      expect(style.height).toBe(`${TOOLBAR_CONTROL_HEIGHT}px`)
      expect(style.borderRadius).toBe(TOOLBAR_CONTROL_RADIUS)
    }
    })

    it('the toolbar row ends with Show inactive, then Sort, then the Cards | List toggle last', async () => {
      listLeagues.mockResolvedValue([makeLeague()])
      renderList('test-club-id')

      await screen.findByText('Internal League')
      const inline = screen.getByTestId('filter-bar-inline-controls')
      const labels = Array.from(inline.children).map((child) => child.textContent ?? '')
      expect(labels[0]).toMatch(/Show inactive/)
      expect(labels[1]).toMatch(/Sort: Name, A to Z/)
      expect(labels[2]).toMatch(/Cards.*List/)
      expect(labels).toHaveLength(3)
    })
  })

  describe('empty states', () => {
    it('shows "No matching leagues" for a search with no result, without a format mention', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ name: 'Riverside League' })])

      renderList('test-club-id')

      await screen.findByText('Riverside League')
      await user.type(screen.getByLabelText('Search'), 'zzz')
      expect(await screen.findByText('No matching leagues')).toBeInTheDocument()
      expect(screen.getByText('No leagues match "zzz". Try a different search.')).toBeInTheDocument()
    })

    it('shows "No matching leagues" for a quick filter with no leagues, and it names the filter', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValueOnce([makeLeague()])
      renderList('test-club-id')
      await screen.findByText('Internal League')

      listLeagues.mockResolvedValue([])
      await user.click(await screen.findByRole('button', { name: /Setup needed/ }))

      expect(await screen.findByText('No matching leagues')).toBeInTheDocument()
      expect(screen.getByText('No leagues match setup needed.')).toBeInTheDocument()
    })

    it('shows "No league available" for a club with no leagues even with a typed search', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([])

      renderList('test-club-id')

      await screen.findByText('No league available')
      await user.type(screen.getByLabelText('Search'), 'cup')
      expect(screen.getByText('No league available')).toBeInTheDocument()
    })
  })

  describe('card contents', () => {
    it('renders the new card body for a league: format and Active badges, next match, played gauge and every team', async () => {
      listLeagues.mockResolvedValue([
        makeLeague({
          currentSeasonLabel: '2026/2027',
          format: 'T20',
          matchCount: 4,
          playedCount: 1,
          nextMatchDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          website: 'https://tvl.example',
          teams: [
            { name: 'Riverside 1st XI', abbreviation: 'R1', logoUrl: null, own: true },
            { name: 'Hawks', abbreviation: null, logoUrl: null, own: false },
          ],
        }),
      ])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      const card = screen.getByRole('heading', { level: 3 }).closest('.MuiCard-root') as HTMLElement
      expect(within(card).getByText('T20')).toBeInTheDocument()
      expect(within(card).getByText('Active')).toBeInTheDocument()
      expect(within(card).queryByText('2 teams')).not.toBeInTheDocument()
      expect(within(card).queryByText('2026/2027')).not.toBeInTheDocument()
      expect(within(card).getByTestId('league-next-match')).toHaveTextContent('Next match')
      expect(within(card).getByText('1 of 4')).toBeInTheDocument()
      expect(within(card).getByTestId('league-gauge-picked')).toHaveTextContent('1 Played')
      expect(within(card).getByTestId('league-gauge-togo')).toHaveTextContent('3 To go')
      expect(within(card).getByText('2 in this season')).toBeInTheDocument()
      expect(within(card).getAllByRole('listitem')).toHaveLength(2)
      expect(within(card).getByTestId('league-social-links')).toBeInTheDocument()
    })

    it('says so when there are no matches and no teams, and hides the played gauge', async () => {
      listLeagues.mockResolvedValue([makeLeague()])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      const card = screen.getByRole('heading', { level: 3 }).closest('.MuiCard-root') as HTMLElement
      expect(within(card).getByTestId('league-next-match')).toHaveTextContent('No matches scheduled yet')
      expect(within(card).queryByTestId('league-progress')).not.toBeInTheDocument()
      expect(within(card).getByText('No teams registered for this season')).toBeInTheDocument()
      expect(within(card).queryByTestId('league-social-links')).not.toBeInTheDocument()
    })
  })
})
