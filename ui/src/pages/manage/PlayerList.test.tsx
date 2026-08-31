import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerList from './PlayerList'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'

const listPlayers = vi.fn()
const deactivatePlayer = vi.fn()
const reactivatePlayer = vi.fn()
const listSections = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/playerApi', () => ({
  listPlayers: (clubId: string) => listPlayers(clubId),
  deactivatePlayer: (clubId: string, playerId: string) => deactivatePlayer(clubId, playerId),
  reactivatePlayer: (clubId: string, playerId: string) => reactivatePlayer(clubId, playerId),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([])
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

  it('renders a card per player with the correct name, fields, chips, and active/inactive badge', async () => {
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' }), makeSection({ id: 'section-2', name: 'Open Men' })])
    listPlayers.mockResolvedValueOnce([
      makePlayer({ id: 'player-1', sectionIds: ['section-1', 'section-2'] }),
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
    expect(screen.getByText('2010-04-12')).toBeInTheDocument()
    expect(screen.getByText('RCC-042')).toBeInTheDocument()
    expect(screen.getByText('U15')).toBeInTheDocument()
    expect(screen.getByText('Open Men')).toBeInTheDocument()

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

  it('clicking Deactivate on an active player calls deactivatePlayer and reflects a pending state', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValueOnce([makePlayer({ active: true })])
    let resolveDeactivate: (value: Player) => void = () => {}
    deactivatePlayer.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDeactivate = resolve
      }),
    )
    // onSuccess invalidates the list query while this card is still mounted, triggering a
    // refetch that also needs a value to resolve to — same gotcha as SponsorList.test.tsx's own
    // equivalent case.
    listPlayers.mockResolvedValueOnce([makePlayer({ active: false })])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(deactivatePlayer).toHaveBeenCalledWith('test-club-id', 'player-1')
    expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

    resolveDeactivate(makePlayer({ active: false }))

    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('clicking Reactivate on an inactive player calls reactivatePlayer', async () => {
    const user = userEvent.setup()
    listPlayers.mockResolvedValueOnce([makePlayer({ active: false })])
    reactivatePlayer.mockResolvedValueOnce(makePlayer({ active: true }))
    // onSuccess invalidates the list query, triggering a refetch.
    listPlayers.mockResolvedValueOnce([makePlayer({ active: true })])

    renderList('test-club-id')

    await screen.findByText('Sipho Ndlovu')
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))

    expect(reactivatePlayer).toHaveBeenCalledWith('test-club-id', 'player-1')
  })
})
