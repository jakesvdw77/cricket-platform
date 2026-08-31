import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerFormPage from './PlayerFormPage'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'

const listPlayers = vi.fn()
const createPlayer = vi.fn()
const updatePlayer = vi.fn()
const listPlayerSections = vi.fn()
const linkPlayerSection = vi.fn()
const unlinkPlayerSection = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/playerApi', () => ({
  listPlayers: (clubId: string) => listPlayers(clubId),
  createPlayer: (clubId: string, payload: unknown) => createPlayer(clubId, payload),
  updatePlayer: (clubId: string, playerId: string, payload: unknown) => updatePlayer(clubId, playerId, payload),
  listPlayerSections: (clubId: string, playerId: string) => listPlayerSections(clubId, playerId),
  linkPlayerSection: (clubId: string, playerId: string, sectionId: string) =>
    linkPlayerSection(clubId, playerId, sectionId),
  unlinkPlayerSection: (clubId: string, playerId: string, sectionId: string) =>
    unlinkPlayerSection(clubId, playerId, sectionId),
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

// Same wrapper-route shape as TeamFormPage.test.tsx, reproducing ManagerHome's Outlet context
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
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="players" element={<div>Player List Page</div>} />
            <Route path="players/new" element={<PlayerFormPage />} />
            <Route path="players/:playerId/edit" element={<PlayerFormPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlayerFormPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/players/new', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(createPlayer).not.toHaveBeenCalled()
  })

  describe('create mode', () => {
    it('renders three tabs only (no Sections tab), and submit calls createPlayer then navigates to the list', async () => {
      const user = userEvent.setup()
      createPlayer.mockResolvedValueOnce(makePlayer())

      renderPage('/manage/players/new', 'test-club-id')

      expect(screen.getByText('Add Player')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Basic Info' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Contact Info' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Cricket Info' })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Sections' })).not.toBeInTheDocument()
      expect(listPlayers).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('First name'), 'Sipho')
      await user.type(screen.getByLabelText('Last name'), 'Ndlovu')
      await user.click(screen.getByRole('button', { name: 'Create player' }))

      expect(createPlayer).toHaveBeenCalledWith(
        'test-club-id',
        expect.objectContaining({ firstName: 'Sipho', lastName: 'Ndlovu' }),
      )
      expect(await screen.findByText('Player List Page')).toBeInTheDocument()
    })
  })

  describe('edit mode', () => {
    it('fetches the player list and prefills from the matching player id', async () => {
      listPlayers.mockResolvedValue([makePlayer({ id: 'player-1', firstName: 'Sipho' }), makePlayer({ id: 'player-2', firstName: 'Other' })])

      renderPage('/manage/players/player-1/edit', 'test-club-id')

      expect(await screen.findByText('Edit Player')).toBeInTheDocument()
      expect(listPlayers).toHaveBeenCalledWith('test-club-id')
      expect(await screen.findByDisplayValue('Sipho')).toBeInTheDocument()
    })

    it('renders an error state when the matching player id is not in the fetched list', async () => {
      listPlayers.mockResolvedValueOnce([makePlayer({ id: 'some-other-id' })])

      renderPage('/manage/players/player-1/edit', 'test-club-id')

      expect(await screen.findByText("Couldn't load this player")).toBeInTheDocument()
    })

    it('submit calls updatePlayer with the outlet clubId, route playerId, and the form payload', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer({ id: 'player-1' })])
      updatePlayer.mockResolvedValueOnce(makePlayer({ id: 'player-1', firstName: 'Renamed' }))

      renderPage('/manage/players/player-1/edit', 'test-club-id')

      await screen.findByText('Edit Player')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      expect(updatePlayer).toHaveBeenCalledWith(
        'test-club-id',
        'player-1',
        expect.objectContaining({ firstName: 'Sipho', lastName: 'Ndlovu' }),
      )
      expect(await screen.findByText('Player List Page')).toBeInTheDocument()
    })

    it('renders all four tabs, one panel visible at a time, with the Save action hidden on the Sections tab', async () => {
      const user = userEvent.setup()
      listPlayers.mockResolvedValue([makePlayer({ id: 'player-1' })])

      renderPage('/manage/players/player-1/edit', 'test-club-id')

      await screen.findByText('Edit Player')
      // Basic Info is active by default.
      expect(screen.getByLabelText('First name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Contact Info' }))
      expect(await screen.findByLabelText('Phone')).toBeInTheDocument()
      expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Cricket Info' }))
      expect(await screen.findByLabelText('Batting stance')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Sections' }))
      expect(await screen.findByText('Not tagged to any sections yet.')).toBeInTheDocument()
      expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Basic Info' }))
      expect(await screen.findByLabelText('First name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    })

    describe('Sections tab', () => {
      function renderEdit() {
        listPlayers.mockResolvedValue([makePlayer({ id: 'player-1' })])
        return renderPage('/manage/players/player-1/edit', 'test-club-id')
      }

      it('renders tagged sections as chips and unlinks via unlinkPlayerSection', async () => {
        const user = userEvent.setup()
        listPlayerSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' })])
        renderEdit()

        await screen.findByText('Edit Player')
        await user.click(screen.getByRole('tab', { name: 'Sections' }))

        expect(await screen.findByText('U15')).toBeInTheDocument()

        // MUI Chip's built-in delete affordance renders as a button with no accessible name of
        // its own — target it via the chip's cancel icon test id instead.
        const chip = screen.getByText('U15').closest('.MuiChip-root') as HTMLElement
        const deleteIcon = chip.querySelector('.MuiChip-deleteIcon') as HTMLElement
        await user.click(deleteIcon)

        expect(unlinkPlayerSection).toHaveBeenCalledWith('test-club-id', 'player-1', 'section-1')
      })

      it('links an existing section via the tree picker, rendering already-tagged sections disabled rather than removing them', async () => {
        const user = userEvent.setup()
        listPlayerSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'U15' })])
        listSections.mockResolvedValue([
          makeSection({ id: 'section-1', name: 'U15' }),
          makeSection({ id: 'section-2', name: 'Open Men' }),
        ])
        renderEdit()

        await screen.findByText('Edit Player')
        await user.click(screen.getByRole('tab', { name: 'Sections' }))
        await user.click(await screen.findByRole('button', { name: 'Link existing' }))

        // A real tree (SectionTree), not a flat search Autocomplete — the already-tagged section
        // still renders (disabled), it isn't removed from the candidate pool.
        const dialog = await screen.findByRole('dialog')
        const alreadyTagged = within(dialog).getByRole('treeitem', { name: 'U15' })
        expect(alreadyTagged).toHaveAttribute('aria-disabled', 'true')

        await user.click(within(dialog).getByText('Open Men'))

        expect(linkPlayerSection).toHaveBeenCalledWith('test-club-id', 'player-1', 'section-2')
      })
    })
  })
})
