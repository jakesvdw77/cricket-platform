import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerList from './PlayerList'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'

const listPlayers = vi.fn()
const listSections = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/playerApi', () => ({
  listPlayers: (clubId: string, params: unknown) => listPlayers(clubId, params),
  deactivatePlayer: vi.fn(),
  reactivatePlayer: vi.fn(),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([])
  // docs/specs/043-list-toolbar-gold-standard.md: PlayerList's Section filter now persists via
  // usePersistedListFilters — clear the real jsdom localStorage so a selection made in one test
  // never leaks into the next.
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
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(screen.getByText('No club is associated with your account.')).toBeInTheDocument()
    expect(listPlayers).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listPlayers.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No players yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listPlayers.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load players")).toBeInTheDocument()
    expect(
      screen.getByText("Something went wrong loading your club's players. Please try again."),
    ).toBeInTheDocument()
  })

  it('renders the "No players yet" empty state when the club has no players', async () => {
    listPlayers.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No players yet')).toBeInTheDocument()
  })

  // docs/specs/061-player-card-avatar-redesign.md: PlayerList now renders the bespoke PlayerCard
  // (jersey chip, section-name-plus-overflow corner chip, Inactive badge) rather than the old
  // generic RecordCard fields (DOB, membership number) — PlayerCard's own content behavior
  // (icon rows, corner chips) is unit-tested in PlayerCard.test.tsx; this only confirms PlayerList
  // resolves and passes the right sectionNames/badge/jerseyNumber through to it per player.
  it('renders a card per player with the correct name, section chips, jersey number, and active/inactive badge', async () => {
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' }), makeSection({ id: 'section-2', name: 'Open Men' })])
    listPlayers.mockResolvedValueOnce([
      makePlayer({ id: 'player-1', sectionIds: ['section-1', 'section-2'], jerseyNumber: 9 }),
      makePlayer({
        id: 'player-2',
        firstName: 'Past',
        lastName: 'Player',
        dateOfBirth: null,
        clubMembershipNumber: null,
        active: false,
      }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('Sipho Ndlovu')).toBeInTheDocument()
    expect(screen.getByText('#9')).toBeInTheDocument()
    expect(screen.getByText('U15')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()

    expect(screen.getByText('Past Player')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against name)', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValueOnce([
      makePlayer({ id: 'player-1', firstName: 'Sipho', lastName: 'Ndlovu' }),
      makePlayer({ id: 'player-2', firstName: 'Jane', lastName: 'Smith' }),
    ])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'sipho' } })

    expect(await screen.findByText('Sipho Ndlovu')).toBeInTheDocument()
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

    expect(await screen.findByText('No matching players')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Player' }))
    expect(await screen.findByText('Add Player Page')).toBeInTheDocument()
  })

  // docs/specs/049-record-list-edit-action-rollout.md: mirrors MatchList.test.tsx's own
  // precedent test for the View+Edit dual-render footer.
  it('renders View and Edit together on a card, both pointing at the player\'s own routes', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1' })])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    expect(screen.getByRole('link', { name: 'Sipho Ndlovu' })).toHaveAttribute('href', '/manage/players/player-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/players/player-1/edit')
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the list card at all — active or inactive — it moved to PlayerFormPage's own actions bar.
  it('never renders a Deactivate/Reactivate button on the card, active or inactive', async () => {
    listPlayers.mockResolvedValueOnce([
      makePlayer({ id: 'player-1', active: true }),
      makePlayer({ id: 'player-2', firstName: 'Past', lastName: 'Player', active: false }),
    ])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    expect(screen.getByText('Past Player')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('selecting a section in the filter re-fetches with the sectionId param, clearing it removes it', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([makePlayer()])
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' })])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    expect(listPlayers).toHaveBeenCalledWith('test-club-id', { sectionId: undefined })

    await user.click(screen.getByLabelText('Section'))
    await user.click(within(screen.getByRole('treeitem', { name: 'U15' })).getByText('U15'))

    expect(await screen.findByLabelText('Section')).toHaveValue('U15')
    await waitFor(() => expect(listPlayers).toHaveBeenCalledWith('test-club-id', { sectionId: 'section-1' }))

    await user.click(screen.getByLabelText('Section'))
    await user.click(screen.getByRole('button', { name: /all sections/i }))

    await waitFor(() =>
      expect(listPlayers).toHaveBeenLastCalledWith('test-club-id', { sectionId: undefined }),
    )
  })

  // docs/specs/043-list-toolbar-gold-standard.md: the Sort Select was replaced by a compact icon
  // toggle — this exercises the previously-dead `direction === 'desc'` branch for real, not just
  // visually.
  it('clicking the sort icon reverses the card order, and flips its own accessible name', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValueOnce([
      makePlayer({ id: 'player-1', firstName: 'Amy', lastName: 'Ansell' }),
      makePlayer({ id: 'player-2', firstName: 'Zed', lastName: 'Zulu' }),
    ])

    renderList('test-club-id')

    await screen.findByText('Amy Ansell')
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Amy Ansell',
      'Zed Zulu',
    ])

    await user.click(screen.getByRole('button', { name: 'Name, Z to A' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Zed Zulu',
      'Amy Ansell',
    ])
    expect(screen.getByRole('button', { name: 'Name, A to Z' })).toBeInTheDocument()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: Section selection persists per club across
  // visits — Search stays a separate, non-persisted useState. Mirrors MatchList.test.tsx's own
  // persistence assertions.
  it('reapplies a persisted section filter on mount, and never persists the search text', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValue([makePlayer()])
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' })])
    localStorage.setItem('playerList:filters:test-club-id', JSON.stringify({ sectionId: 'section-1' }))

    renderList('test-club-id')

    await waitFor(() => expect(listPlayers).toHaveBeenCalledWith('test-club-id', { sectionId: 'section-1' }))
    expect(await screen.findByLabelText('Section')).toHaveValue('U15')

    await user.type(screen.getByLabelText('Search'), 'Sipho')

    const persisted = JSON.parse(localStorage.getItem('playerList:filters:test-club-id') as string)
    expect(persisted).toEqual({ sectionId: 'section-1' })
    expect(persisted).not.toHaveProperty('search')
  })
})
