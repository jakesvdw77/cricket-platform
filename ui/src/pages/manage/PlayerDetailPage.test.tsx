import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerDetailPage from './PlayerDetailPage'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'

const listPlayers = vi.fn()
const listPlayerSections = vi.fn()
const listSections = vi.fn()

const verifyPlayer = vi.fn()
const rejectPlayer = vi.fn()
const deactivatePlayer = vi.fn()
const reactivatePlayer = vi.fn()

vi.mock('../../api/playerApi', () => ({
  listPlayers: (clubId: string, params?: unknown) => (params === undefined ? listPlayers(clubId) : listPlayers(clubId, params)),
  listPlayerSections: (clubId: string, playerId: string) => listPlayerSections(clubId, playerId),
  verifyPlayer: (clubId: string, id: string) => verifyPlayer(clubId, id),
  rejectPlayer: (clubId: string, id: string) => rejectPlayer(clubId, id),
  deactivatePlayer: (clubId: string, id: string) => deactivatePlayer(clubId, id),
  reactivatePlayer: (clubId: string, id: string) => reactivatePlayer(clubId, id),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

const listSeasons = vi.fn()
vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

beforeEach(() => {
  // mockReset: a leftover mockResolvedValueOnce must not leak, now the list waits for the seasons query
  for (const fn of [listPlayers, listPlayerSections, listSections, listSeasons]) fn.mockReset()
  vi.clearAllMocks()
  listSeasons.mockResolvedValue([
    { id: 'season-1', clubId: 'test-club-id', label: '2026', startDate: '2000-01-01', endDate: '2999-12-31', active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '', updatedBy: null },
  ])
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

  it('loads the matching player and renders the four cards, with tagged sections as header chips', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1' }), makePlayer({ id: 'player-2' })])
    listPlayerSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'U15' })])
    listSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'U15' })])

    renderPage('/manage/players/player-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Sipho Ndlovu' })).toBeInTheDocument()
    expect(listPlayers).toHaveBeenCalledWith('test-club-id', { seasonId: 'season-1' })

    for (const name of ['Basic info', 'Contact info', 'Cricket info', 'Stats']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }

    // Section chip now lives in the header, not under a "Sections" heading (removed entirely).
    expect(await screen.findByText('U15')).toBeInTheDocument()
    expect(screen.queryByText('Sections')).not.toBeInTheDocument()

    expect(screen.getByText(/^12 Apr 2010 · \d+ yrs$/)).toBeInTheDocument()
    expect(screen.getByText('Male')).toBeInTheDocument()
    expect(screen.getByText('+27 82 555 0100')).toBeInTheDocument()
    expect(screen.getByText('Bats: Right-handed')).toBeInTheDocument()
    expect(screen.getByText('Bowls: Right-arm, Fast-medium')).toBeInTheDocument()
    expect(screen.getByText('Wicketkeeper: Yes')).toBeInTheDocument()

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/manage/players/player-1/edit')
  })

  it('shows the status badge in the header: Verified, and Suspended for a deactivated player', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1' })])
    const { unmount } = renderPage('/manage/players/player-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
    expect(screen.getByTestId('player-status-badge')).toHaveTextContent('Verified')
    unmount()

    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1', active: false })])
    renderPage('/manage/players/player-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
    expect(screen.getByTestId('player-status-badge')).toHaveTextContent('Suspended')
  })

  // docs/specs/088-players-polls-alignment.md
  describe('player status', () => {
    it('shows no banner for a verified player, and the Status button offers only Suspend', async () => {
      listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1' })])

      renderPage('/manage/players/player-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      expect(screen.queryByTestId('player-status-banner')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Suspend'])
    })

    it('shows an amber banner for an unverified player, with Change status opening the same menu', async () => {
      listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1', verificationStatus: 'UNVERIFIED' })])

      renderPage('/manage/players/player-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      const banner = screen.getByTestId('player-status-banner')
      expect(banner).toHaveAttribute('data-tone', 'warning')
      expect(banner).toHaveTextContent('waiting for you')
      expect(screen.getByTestId('player-status-badge')).toHaveTextContent('Unverified')

      await userEvent.click(within(banner).getByRole('button', { name: 'Change status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Verify', 'Reject'])
    })

    it('verifies from the menu at once, and rejects only after confirming', async () => {
      listPlayers.mockResolvedValue([makePlayer({ id: 'player-1', verificationStatus: 'UNVERIFIED' })])
      verifyPlayer.mockResolvedValue({})
      rejectPlayer.mockResolvedValue({})

      renderPage('/manage/players/player-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      await userEvent.click(screen.getByRole('button', { name: 'Status' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'Verify' }))
      await waitFor(() => expect(verifyPlayer).toHaveBeenCalledWith('test-club-id', 'player-1'))

      await userEvent.click(screen.getByRole('button', { name: 'Status' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'Reject' }))
      expect(await screen.findByRole('dialog', { name: 'Reject this player request?' })).toBeInTheDocument()
      expect(rejectPlayer).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: 'Reject player' }))
      await waitFor(() => expect(rejectPlayer).toHaveBeenCalledWith('test-club-id', 'player-1'))
    })

    it('shows the closed-tone banner for a rejected player, where the menu offers Verify', async () => {
      listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1', verificationStatus: 'REJECTED' })])

      renderPage('/manage/players/player-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      expect(screen.getByTestId('player-status-banner')).toHaveAttribute('data-tone', 'closed')
      await userEvent.click(screen.getByRole('button', { name: 'Status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Verify'])
    })

    it('offers Reactivate for a suspended player and shows no banner', async () => {
      listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1', active: false })])

      renderPage('/manage/players/player-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
      expect(screen.queryByTestId('player-status-banner')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Reactivate'])
    })
  })

  it('renders Medical Aid provider and member number in Contact Info when set', async () => {
    listPlayers.mockResolvedValueOnce([
      makePlayer({ id: 'player-1', medicalAidProvider: 'Discovery Health', medicalAidMemberNumber: 'DH330211' }),
    ])

    renderPage('/manage/players/player-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
    expect(screen.getByText('Medical aid provider')).toBeInTheDocument()
    expect(screen.getByText('Discovery Health')).toBeInTheDocument()
    expect(screen.getByText('Medical aid number')).toBeInTheDocument()
    expect(screen.getByText('DH330211')).toBeInTheDocument()
  })

  it('shows a dash for Medical Aid provider and member number when both are unset', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1' })])

    renderPage('/manage/players/player-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })

    for (const label of ['Medical aid provider', 'Medical aid number']) {
      const field = screen.getByText(label).parentElement as HTMLElement
      expect(within(field).getByText('–')).toBeInTheDocument()
    }
  })

  it('shows the real games counts in the key figures and the Stats card, with runs and wickets as dashes', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1', gamesThisSeason: 12, gamesOverall: 48, jerseyNumber: 9 })])

    renderPage('/manage/players/player-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })

    expect(screen.getByTestId('key-figure-season-value')).toHaveTextContent('12')
    expect(screen.getByTestId('key-figure-overall-value')).toHaveTextContent('48')
    expect(screen.getByTestId('key-figure-jersey-value')).toHaveTextContent('#9')

    expect(screen.getByText('More coming soon')).toBeInTheDocument()
    const statsFields = within(screen.getByRole('heading', { name: 'Stats' }).closest('.MuiCard-root') as HTMLElement)
      .getAllByTestId('player-info-field')
    const byLabel = (label: string) => statsFields.find((field) => field.textContent?.startsWith(label)) as HTMLElement
    expect(byLabel('Games this season')).toHaveTextContent('12')
    expect(byLabel('Games overall')).toHaveTextContent('48')
    expect(byLabel('Runs')).toHaveTextContent('–')
    expect(byLabel('Wickets')).toHaveTextContent('–')
  })

  it('offers Call and Email links for a phone number and an email, and omits them when there are none', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1', phone: '083 555 0177', email: 'sipho@example.com' })])
    const { unmount } = renderPage('/manage/players/player-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:083 555 0177')
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:sipho@example.com')
    unmount()

    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1', phone: null, email: null })])
    renderPage('/manage/players/player-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Email' })).not.toBeInTheDocument()
  })

  it('draws cricket info that is not on file as dashed chips, so the card keeps its three chips', async () => {
    listPlayers.mockResolvedValueOnce([
      makePlayer({ id: 'player-1', battingStance: null, bowlingArm: null, bowlingType: null, isWicketKeeper: false }),
    ])

    renderPage('/manage/players/player-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Sipho Ndlovu' })
    const chips = screen.getAllByTestId('player-info-chip')
    expect(chips.map((chip) => chip.textContent)).toEqual(['Bats: –', 'Bowls: –', 'Wicketkeeper: No'])
    expect(chips.map((chip) => chip.getAttribute('data-on'))).toEqual(['false', 'false', 'false'])
  })

  it('renders the full page with no error and no section chip when the player has no tagged sections', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'player-1' })])
    listPlayerSections.mockResolvedValueOnce([])

    renderPage('/manage/players/player-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Sipho Ndlovu' })).toBeInTheDocument()
    expect(screen.queryByText('U15')).not.toBeInTheDocument()
  })

  it('renders an error state when the matching player id is not in the fetched list', async () => {
    listPlayers.mockResolvedValueOnce([makePlayer({ id: 'some-other-id' })])

    renderPage('/manage/players/player-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this player")).toBeInTheDocument()
  })
})
