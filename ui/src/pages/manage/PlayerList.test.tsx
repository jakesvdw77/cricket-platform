import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerList from './PlayerList'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'

const listPlayers = vi.fn()
const getPlayersSummary = vi.fn()
const listSections = vi.fn()
const listSeasons = vi.fn()
const verifyPlayer = vi.fn()
const rejectPlayer = vi.fn()
const deactivatePlayer = vi.fn()
const reactivatePlayer = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/playerApi', () => ({
  listPlayers: (clubId: string, params: unknown) => listPlayers(clubId, params),
  getPlayersSummary: (clubId: string, filters: unknown) => getPlayersSummary(clubId, filters),
  playersSummaryKey: (clubId: string, filters: unknown) => ['managed-club', clubId, 'players', 'summary', filters],
  verifyPlayer: (clubId: string, id: string) => verifyPlayer(clubId, id),
  rejectPlayer: (clubId: string, id: string) => rejectPlayer(clubId, id),
  deactivatePlayer: (clubId: string, id: string) => deactivatePlayer(clubId, id),
  reactivatePlayer: (clubId: string, id: string) => reactivatePlayer(clubId, id),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

beforeEach(() => {
  // mockReset (not just clear): a leftover mockReturnValueOnce from one test must not leak into the next now that the list
  // query waits for the seasons query before it first calls listPlayers
  for (const fn of [listPlayers, getPlayersSummary, listSections, listSeasons]) fn.mockReset()
  vi.clearAllMocks()
  listSections.mockResolvedValue([])
  // The default season is the one containing today.
  listSeasons.mockResolvedValue([
    { id: 'season-1', clubId: 'test-club-id', label: '2026', startDate: '2000-01-01', endDate: '2999-12-31', active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '', updatedBy: null },
  ])
  getPlayersSummary.mockResolvedValue({ playersShown: 12, inSquad: 9, selected: 7, unverified: 3 })
  for (const fn of [verifyPlayer, rejectPlayer, deactivatePlayer, reactivatePlayer]) fn.mockResolvedValue({})
  // docs/specs/043-list-toolbar-gold-standard.md: PlayerList's Section filter persists via usePersistedListFilters -
  // clear the real jsdom localStorage so a selection made in one test never leaks into the next.
  localStorage.clear()
})

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    personId: 'person-1',
    clubId: 'test-club-id',
    firstName: 'Sipho',
    lastName: 'Ndlovu',
    dateOfBirth: '2010-04-12',
    gender: 'MALE',
    photoUrl: null,
    clubMembershipNumber: 'RCC-042',
    medicalAidProvider: null,
    medicalAidMemberNumber: null,
    phone: null,
    email: null,
    altContactName: null,
    altContactPhone: null,
    battingStance: null,
    bowlingArm: null,
    bowlingType: null,
    isWicketKeeper: false,
    active: true,
    sectionIds: [],
    jerseyNumber: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    verificationStatus: 'VERIFIED',
    gamesThisSeason: 0,
    gamesOverall: 0,
    ...overrides,
  }
}

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    clubId: 'test-club-id',
    parentSectionId: null,
    name: 'U15',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// PlayerList reads clubId via useOutletContext, not useParams (normally threaded through by
// ManagerHome's own <Outlet context={{ clubId }} />) — same wrapper-route shape as
// SponsorList.test.tsx, reproduced here without pulling ManagerHome in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/players']}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="players" element={<PlayerList />} />
            <Route path="players/new" element={<div>Add Player Page</div>} />
            <Route path="players/:id/edit" element={<div>Edit Player Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlayerList', () => {
  const counter = (id: string) => screen.getByTestId(`page-counter-${id}`)

  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(screen.getByText('No club is associated with your account.')).toBeInTheDocument()
    expect(listPlayers).not.toHaveBeenCalled()
    expect(getPlayersSummary).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listPlayers.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No players yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listPlayers.mockRejectedValue(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load players")).toBeInTheDocument()
  })

  it('renders the "No players yet" empty state when the club has no players', async () => {
    listPlayers.mockResolvedValue([])

    renderList('test-club-id')

    expect(await screen.findByText('No players yet')).toBeInTheDocument()
  })

  it('renders a card per player with the status badge, section chips and the five fixed rows', async () => {
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' })])
    listPlayers.mockResolvedValue([
      makePlayer({ id: 'p1', firstName: 'Amy', lastName: 'Ansell', jerseyNumber: 7, phone: '082 555 0142', sectionIds: ['section-1'] }),
      makePlayer({ id: 'p2', firstName: 'Zed', lastName: 'Zulu', verificationStatus: 'UNVERIFIED' }),
    ])

    renderList('test-club-id')

    expect(await screen.findByRole('heading', { name: 'Amy Ansell' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zed Zulu' })).toBeInTheDocument()
    expect(screen.getAllByTestId('player-status-badge').map((badge) => badge.textContent)).toEqual(['Verified', 'Unverified'])
    expect(screen.getByText('U15')).toBeInTheDocument()
    expect(screen.getAllByText('No section')).toHaveLength(1)
    // every card has the same five rows
    expect(screen.getAllByTestId('player-detail-row')).toHaveLength(10)
    expect(screen.getByText('#7')).toBeInTheDocument()
  })

  it('hides suspended and rejected players by default (includeInactive false) and the switch brings them back', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([makePlayer()])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ includeInactive: false }))

    await user.click(screen.getByRole('checkbox', { name: /show suspended and rejected players/i }))

    await waitFor(() =>
      expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ includeInactive: true })),
    )
    expect(await within(counter('shown')).findByText('Players shown')).toBeInTheDocument()
    expect(getPlayersSummary).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ includeInactive: true }))
  })

  it('sends missingDateOfBirth=true when the switch is on, and saves it with the other persisted filters', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([makePlayer({ dateOfBirth: null })])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ missingDateOfBirth: undefined }))

    await user.click(screen.getByRole('checkbox', { name: /missing date of birth/i }))

    await waitFor(() =>
      expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ missingDateOfBirth: true })),
    )
    // a player with no date of birth shows "–" in its Born row, not a separate badge
    expect(screen.getByText('Born').parentElement).toHaveTextContent('–')
    expect(JSON.parse(localStorage.getItem('playerList:filters:test-club-id') as string)).toMatchObject({ missingDateOfBirth: true })
  })

  it('shows the "Every player has a date of birth" empty state when the filter finds nobody', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([makePlayer()])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    listPlayers.mockResolvedValue([])
    await user.click(screen.getByRole('checkbox', { name: /missing date of birth/i }))

    expect(await screen.findByText('Every player has a date of birth')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against name), client-side', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([
      makePlayer({ id: 'p1', firstName: 'Amy', lastName: 'Ansell' }),
      makePlayer({ id: 'p2', firstName: 'Zed', lastName: 'Zulu' }),
    ])

    renderList('test-club-id')

    await screen.findByRole('heading', { name: 'Amy Ansell' })
    await user.type(screen.getByLabelText('Search'), 'zul')

    expect(screen.queryByRole('heading', { name: 'Amy Ansell' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zed Zulu' })).toBeInTheDocument()
    // search never reaches the backend
    expect(listPlayers).not.toHaveBeenCalledWith('test-club-id', expect.objectContaining({ search: expect.anything() }))
  })

  it('renders Edit and View on a card, both pointing at the player\'s own routes', async () => {
    listPlayers.mockResolvedValue([makePlayer({ id: 'player-1' })])

    renderList('test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/players/player-1/edit')
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/manage/players/player-1')
  })

  it('selecting a section in the filter re-fetches with the sectionId param, clearing it removes it', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([makePlayer()])
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' })])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ sectionId: undefined }))

    await user.click(screen.getByLabelText('Section'))
    await user.click(within(screen.getByRole('treeitem', { name: 'U15' })).getByText('U15'))

    expect(await screen.findByLabelText('Section')).toHaveValue('U15')
    await waitFor(() => expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ sectionId: 'section-1' })))
    expect(getPlayersSummary).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ sectionId: 'section-1' }))
    expect(await screen.findByText('Showing: U15')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Section'))
    await user.click(screen.getByRole('button', { name: /all sections/i }))

    await waitFor(() => expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ sectionId: undefined })))
  })

  it('sorts by name by default, and the sort menu offers Z to A and games this season, most or fewest first', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([
      makePlayer({ id: 'player-1', firstName: 'Amy', lastName: 'Ansell', gamesThisSeason: 3 }),
      makePlayer({ id: 'player-2', firstName: 'Zed', lastName: 'Zulu', gamesThisSeason: 11 }),
      makePlayer({ id: 'player-3', firstName: 'Bea', lastName: 'Bell', gamesThisSeason: 3 }),
    ])
    const names = () => screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)

    renderList('test-club-id')

    await screen.findByRole('heading', { name: 'Amy Ansell' })
    expect(names()).toEqual(['Amy Ansell', 'Bea Bell', 'Zed Zulu'])

    await user.click(screen.getByRole('button', { name: /a to z/i }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Name, A to Z', 'Name, Z to A', 'Games this season, most first', 'Games this season, fewest first',
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Name, Z to A' }))
    expect(names()).toEqual(['Zed Zulu', 'Bea Bell', 'Amy Ansell'])

    await user.click(screen.getByRole('button', { name: /z to a/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Games this season, most first' }))
    // Zed has 11; Amy and Bea tie on 3 and keep name order
    expect(names()).toEqual(['Zed Zulu', 'Amy Ansell', 'Bea Bell'])
    expect(screen.getByRole('button', { name: /most games/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /most games/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Games this season, fewest first' }))
    expect(names()).toEqual(['Amy Ansell', 'Bea Bell', 'Zed Zulu'])
    // sorting is client-side: it never refetches
    expect(listPlayers).toHaveBeenCalledTimes(1)
  })

  it('the same sort order applies to the list view', async () => {
    const user = userEvent.setup()
    localStorage.setItem('playerList:view', 'list')
    listPlayers.mockResolvedValue([
      makePlayer({ id: 'player-1', firstName: 'Amy', lastName: 'Ansell', gamesThisSeason: 1 }),
      makePlayer({ id: 'player-2', firstName: 'Zed', lastName: 'Zulu', gamesThisSeason: 9 }),
    ])

    renderList('test-club-id')

    await screen.findByRole('table', { name: 'Players' })
    await user.click(screen.getByRole('button', { name: /a to z/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Games this season, most first' }))

    expect(screen.getAllByTestId('player-row').map((row) => within(row).getByRole('link').textContent)).toEqual(['Zed Zulu', 'Amy Ansell'])
  })

  it('reapplies a persisted section filter on mount, and never persists the search text, the switch or the quick filter', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([makePlayer()])
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' })])
    localStorage.setItem('playerList:filters:test-club-id', JSON.stringify({ sectionId: 'section-1', missingDateOfBirth: false }))

    renderList('test-club-id')

    await waitFor(() => expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ sectionId: 'section-1' })))
    expect(await screen.findByLabelText('Section')).toHaveValue('U15')
    await user.type(screen.getByLabelText('Search'), 'Sip')
    await user.click(screen.getByRole('checkbox', { name: /show suspended and rejected players/i }))
    await user.click(await screen.findByTestId('page-counter-unverified'))

    const persisted = JSON.parse(localStorage.getItem('playerList:filters:test-club-id') as string)
    expect(Object.keys(persisted).sort()).toEqual(['missingDateOfBirth', 'sectionId'])
  })

  describe('the Status button', () => {
    it('Reject asks first, then rejects the player and refreshes the list', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer({ id: 'p9', verificationStatus: 'UNVERIFIED' })])

      renderList('test-club-id')

      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      await user.click(screen.getByRole('button', { name: 'Change status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Verify', 'Reject'])
      await user.click(screen.getByRole('menuitem', { name: 'Reject' }))

      expect(await screen.findByRole('dialog', { name: 'Reject this player request?' })).toBeInTheDocument()
      expect(rejectPlayer).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Reject player' }))

      await waitFor(() => expect(rejectPlayer).toHaveBeenCalledWith('test-club-id', 'p9'))
      await waitFor(() => expect(listPlayers.mock.calls.length).toBeGreaterThan(1))
    })

    it('Verify acts at once, and a suspended player offers Reactivate', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer({ id: 'p9', verificationStatus: 'UNVERIFIED' })])

      const { unmount } = renderList('test-club-id')

      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      await user.click(screen.getByRole('button', { name: 'Change status' }))
      await user.click(screen.getByRole('menuitem', { name: 'Verify' }))
      await waitFor(() => expect(verifyPlayer).toHaveBeenCalledWith('test-club-id', 'p9'))
      unmount()

      listPlayers.mockResolvedValue([makePlayer({ id: 'p8', active: false })])
      renderList('test-club-id')
      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      await user.click(screen.getByRole('button', { name: 'Change status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Reactivate'])
    })
  })

  // docs/specs/088-players-polls-alignment.md (A): the counters and the quick filters
  describe('counters and quick filters', () => {
    it('shows the four counters from the summary, with the amber tone only on Unverified', async () => {
      listPlayers.mockResolvedValue([makePlayer()])

      renderList('test-club-id')

      await screen.findByTestId('page-counter-shown')
      expect(within(counter('shown')).getByText('12')).toBeInTheDocument()
      expect(within(counter('shown')).getByText('Active players')).toBeInTheDocument()
      expect(within(counter('in-squad')).getByText('9')).toBeInTheDocument()
      expect(within(counter('in-squad')).getByText('In a squad this season')).toBeInTheDocument()
      expect(within(counter('selected')).getByText('7')).toBeInTheDocument()
      expect(within(counter('selected')).getByText('Players selected this season')).toBeInTheDocument()
      expect(within(counter('unverified')).getByText('3')).toBeInTheDocument()
      const colour = (id: string) => getComputedStyle(within(counter(id)).getByTestId('page-counter-value')).color
      expect(colour('unverified')).not.toBe(colour('in-squad'))
      expect(counter('shown')).toHaveAttribute('aria-pressed', 'true')
    })

    it('asks the summary for the list filters and the default season, never the search', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer()])

      renderList('test-club-id')

      await screen.findByTestId('page-counter-shown')
      expect(getPlayersSummary).toHaveBeenLastCalledWith('test-club-id', {
        sectionId: undefined,
        missingDateOfBirth: undefined,
        includeInactive: false,
        seasonId: 'season-1',
      })
      await user.type(screen.getByLabelText('Search'), 'sip')
      expect(getPlayersSummary).toHaveBeenLastCalledWith('test-club-id', expect.not.objectContaining({ search: expect.anything() }))
    })

    it('choosing a season counter sends the backend focus with the season, and names it in the scope text', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer()])

      renderList('test-club-id')

      await screen.findByTestId('page-counter-in-squad')
      await user.click(counter('in-squad'))

      await waitFor(() =>
        expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ focus: 'in-squad', seasonId: 'season-1' })),
      )
      expect(counter('in-squad')).toHaveAttribute('aria-pressed', 'true')
      expect(counter('shown')).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByText(/Showing 1 player · In a squad this season/)).toBeInTheDocument()
      // the counters keep describing the list's filters, not the quick filter
      expect(getPlayersSummary).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ focus: expect.anything() }))
    })

    it('Unverified sends focus=unverified (the season rides on every request); choosing another replaces it; the active one or the first card clears it', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer()])

      renderList('test-club-id')

      await screen.findByTestId('page-counter-unverified')
      await user.click(counter('unverified'))
      await waitFor(() => expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ focus: 'unverified', seasonId: 'season-1' })))

      await user.click(counter('selected'))
      await waitFor(() => expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ focus: 'selected', seasonId: 'season-1' })))
      expect(counter('unverified')).toHaveAttribute('aria-pressed', 'false')

      await user.click(counter('selected'))
      await waitFor(() => expect(listPlayers.mock.calls.at(-1)?.[1].focus).toBeUndefined())

      await user.click(counter('in-squad'))
      await waitFor(() => expect(listPlayers.mock.calls.at(-1)?.[1].focus).toBe('in-squad'))
      await user.click(counter('shown'))
      await waitFor(() => expect(listPlayers.mock.calls.at(-1)?.[1].focus).toBeUndefined())
      expect(counter('shown')).toHaveAttribute('aria-pressed', 'true')
    })

    it('a counter at zero is a plain card, not a button', async () => {
      getPlayersSummary.mockResolvedValue({ playersShown: 5, inSquad: 2, selected: 0, unverified: 0 })
      listPlayers.mockResolvedValue([makePlayer()])

      renderList('test-club-id')

      await screen.findByTestId('page-counter-selected')
      expect(counter('selected').tagName).not.toBe('BUTTON')
      expect(counter('unverified').tagName).not.toBe('BUTTON')
      expect(counter('in-squad').tagName).toBe('BUTTON')
    })

    it('hides the counters when the summary fails, and the list still works', async () => {
      getPlayersSummary.mockRejectedValue(new Error('boom'))
      listPlayers.mockResolvedValue([makePlayer()])

      renderList('test-club-id')

      expect(await screen.findByRole('heading', { name: 'Sipho Ndlovu' })).toBeInTheDocument()
      await waitFor(() => expect(getPlayersSummary).toHaveBeenCalled())
      expect(screen.queryByTestId('page-counter-shown')).not.toBeInTheDocument()
    })

    it('shows a "Nobody here" empty state when a quick filter finds nobody', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer()])

      renderList('test-club-id')

      await screen.findByTestId('page-counter-unverified')
      listPlayers.mockResolvedValue([])
      await user.click(counter('unverified'))

      expect(await screen.findByText('Nobody here')).toBeInTheDocument()
    })

    it('on a phone the quick filter is a chip, counts in the Filters badge, has a Quick filter row, and Clear all clears it', async () => {
      const user = userEvent.setup()
      window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia
      try {
        listPlayers.mockResolvedValue([makePlayer()])

        renderList('test-club-id')

        await screen.findByTestId('page-counter-unverified')
        // the phone shows the short label; the full name stays accessible
        expect(within(counter('unverified')).getByText('Unverified')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '3 Unverified players' }))

        expect(await screen.findByRole('button', { name: 'Filters, 1 active' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Remove filter Unverified players' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Filters, 1 active' }))
        expect(await screen.findByText(/Quick filter:/)).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: /show suspended and rejected players/i })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Clear all' }))
        await waitFor(() => expect(listPlayers.mock.calls.at(-1)?.[1].focus).toBeUndefined())
        expect(counter('shown')).toHaveAttribute('aria-pressed', 'true')
      } finally {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
    })
  })

  // docs/specs/088-players-polls-alignment.md (E) and (F): games played and the Cards | List view
  describe('Cards | List view', () => {
    it('sends the default season on the very first list request, so the cards show "this season" at once', async () => {
      listPlayers.mockResolvedValue([makePlayer({ gamesThisSeason: 12, gamesOverall: 48 })])

      renderList('test-club-id')

      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      expect(listPlayers.mock.calls[0][1]).toMatchObject({ seasonId: 'season-1' })
      expect(listPlayers).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('12 games this season')).toBeInTheDocument()
      expect(screen.getByLabelText('48 games overall')).toBeInTheDocument()
    })

    it('shows cards by default, and the switch swaps them for the list of the same players', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([
        makePlayer({ id: 'p1', firstName: 'Amy', lastName: 'Ansell' }),
        makePlayer({ id: 'p2', firstName: 'Zed', lastName: 'Zulu' }),
      ])

      renderList('test-club-id')

      await screen.findByRole('heading', { name: 'Amy Ansell' })
      expect(screen.queryByRole('table', { name: 'Players' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')

      await user.click(screen.getByRole('button', { name: 'List' }))

      expect(await screen.findByRole('table', { name: 'Players' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Amy Ansell' })).not.toBeInTheDocument()
      expect(screen.getAllByTestId('player-row')).toHaveLength(2)
      expect(screen.getByRole('link', { name: 'Amy Ansell' })).toHaveAttribute('href', '/manage/players/p1')
      // the same list request: switching the view does not refetch or change any filter
      expect(listPlayers).toHaveBeenCalledTimes(1)
    })

    it('remembers the chosen view per page: saved at once, and a fresh mount comes back in it', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer()])

      const { unmount } = renderList('test-club-id')
      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      await user.click(screen.getByRole('button', { name: 'List' }))
      expect(localStorage.getItem('playerList:view')).toBe('list')
      unmount()

      renderList('test-club-id')
      expect(await screen.findByRole('table', { name: 'Players' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Cards' }))
      expect(localStorage.getItem('playerList:view')).toBe('cards')
    })

    it('keeps the counters, filters and search working in the list view', async () => {
      const user = userEvent.setup()
      localStorage.setItem('playerList:view', 'list')
      listPlayers.mockResolvedValue([
        makePlayer({ id: 'p1', firstName: 'Amy', lastName: 'Ansell' }),
        makePlayer({ id: 'p2', firstName: 'Zed', lastName: 'Zulu' }),
      ])

      renderList('test-club-id')

      await screen.findByRole('table', { name: 'Players' })
      expect(within(counter('shown')).getByText('12')).toBeInTheDocument()
      await user.type(screen.getByLabelText('Search'), 'zul')
      expect(screen.getAllByTestId('player-row')).toHaveLength(1)
      await user.click(counter('in-squad'))
      await waitFor(() => expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ focus: 'in-squad' })))
      expect(screen.getByText(/Showing 2 players · In a squad this season/)).toBeInTheDocument()
    })

    it('a list row has the same Status menu as a card, and Reject still asks first', async () => {
      const user = userEvent.setup()
      localStorage.setItem('playerList:view', 'list')
      listPlayers.mockResolvedValue([makePlayer({ id: 'p9', verificationStatus: 'UNVERIFIED' })])

      renderList('test-club-id')

      await screen.findByRole('table', { name: 'Players' })
      await user.click(screen.getByRole('button', { name: 'Change status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Verify', 'Reject'])
      await user.click(screen.getByRole('menuitem', { name: 'Reject' }))
      expect(await screen.findByRole('dialog', { name: 'Reject this player request?' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Reject player' }))
      await waitFor(() => expect(rejectPlayer).toHaveBeenCalledWith('test-club-id', 'p9'))
    })

    it('on a phone the switch is the first control in the Filters sheet, full width, and it swaps the view', async () => {
      const user = userEvent.setup()
      window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia
      try {
        listPlayers.mockResolvedValue([makePlayer()])

        renderList('test-club-id')

        await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
        // not on the content line on a phone
        expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Filters' }))
        const sheetToggle = await screen.findByRole('group', { name: 'View' })
        const controls = sheetToggle.closest('[data-testid="filter-sheet-fields"]')?.lastElementChild as HTMLElement
        expect(controls.firstElementChild).toContainElement(sheetToggle)

        await user.click(within(sheetToggle).getByRole('button', { name: 'List' }))
        expect(localStorage.getItem('playerList:view')).toBe('list')
        // the open sheet hides the page behind it from the accessibility tree
        expect(screen.getByRole('table', { name: 'Players', hidden: true })).toBeInTheDocument()
      } finally {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
    })
  })
})

