import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerDetailPage from './PlayerDetailPage'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'

const listPlayers = vi.fn()
const listPlayerSections = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/playerApi', () => ({
  listPlayers: (clubId: string) => listPlayers(clubId),
  listPlayerSections: (clubId: string, playerId: string) => listPlayerSections(clubId, playerId),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([])
  listPlayerSections.mockResolvedValue([])
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
    phone: '+27 82 555 0100',
    email: 'sipho@example.com',
    altContactName: null,
    altContactPhone: null,
    battingStance: 'RIGHT_HANDED',
    bowlingArm: 'RIGHT_ARM',
    bowlingType: 'FAST_MEDIUM',
    isWicketKeeper: true,
    active: true,
    sectionIds: [],
    jerseyNumber: 7,
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
            <Route path="players" element={<div>Player List Page</div>} />
            <Route path="players/:playerId" element={<PlayerDetailPage />} />
            <Route path="players/:playerId/edit" element={<div>Edit Player Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlayerDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/players/player-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listPlayers).not.toHaveBeenCalled()
  })

  it('loads the matching player and renders every section read-only, with tagged sections as chips', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1' }), makePlayer({ id: 'player-2' })])
    listPlayerSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'U15' })])
    listSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'U15' })])

    renderPage('/manage/players/player-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Sipho Ndlovu' })).toBeInTheDocument()
    expect(listPlayers).toHaveBeenCalledWith('test-club-id')

    expect(screen.getByText('Basic Info')).toBeInTheDocument()
    expect(screen.getByText('Contact Info')).toBeInTheDocument()
    expect(screen.getByText('Cricket Info')).toBeInTheDocument()
    expect(screen.getByText('Sections')).toBeInTheDocument()

    expect(screen.getByText('2010-04-12')).toBeInTheDocument()
    expect(screen.getByText('Male')).toBeInTheDocument()
    expect(screen.getByText('+27 82 555 0100')).toBeInTheDocument()
    expect(screen.getByText('Right-handed')).toBeInTheDocument()
    expect(screen.getByText('Right-arm')).toBeInTheDocument()
    expect(screen.getByText('Fast-medium')).toBeInTheDocument()

    expect(await screen.findByText('U15')).toBeInTheDocument()

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/manage/players/player-1/edit')
  })

  it('renders "Not tagged to any sections yet" when the player has no tagged sections', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1' })])

    renderPage('/manage/players/player-1', 'test-club-id')

    expect(await screen.findByText('Not tagged to any sections yet.')).toBeInTheDocument()
  })

  it('renders an error state when the matching player id is not in the fetched list', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'some-other-id' })])

    renderPage('/manage/players/player-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this player")).toBeInTheDocument()
  })
})
