import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerSlotPicker } from './PlayerSlotPicker'
import type { PlayerSlotPickerProps } from './PlayerSlotPicker'
import * as playerApi from '../../api/playerApi'
import * as squadApi from '../../api/teamSquadApi'
import * as resultApi from '../../api/matchResultApi'
import { resetPlayerNameModeForTests } from '../../hooks/usePlayerNameMode'

vi.mock('../../api/playerApi', () => ({ listPlayers: vi.fn() }))
vi.mock('../../api/teamSquadApi', () => ({ listSquad: vi.fn() }))
vi.mock('../../api/matchResultApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/matchResultApi')>()),
  listGuestNames: vi.fn(),
}))

const person = (id: string, firstName: string, lastName: string) => ({ id, playerProfileId: id, firstName, lastName })

function setup(props: Partial<PlayerSlotPickerProps> = {}) {
  const onPickPlayer = vi.fn()
  const onPickGuest = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PlayerSlotPicker
        open
        onClose={vi.fn()}
        clubId="club-1"
        teamId="team-1"
        seasonId="season-1"
        title="Swap player"
        onPickPlayer={onPickPlayer}
        onPickGuest={onPickGuest}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onPickPlayer, onPickGuest }
}

describe('PlayerSlotPicker', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPlayerNameModeForTests()
    vi.mocked(squadApi.listSquad).mockResolvedValue([
      person('p1', 'Ann', 'Ash'),
      person('p2', 'Bob', 'Birch'),
      person('p3', 'Cal', 'Cedar'),
    ] as never)
    vi.mocked(playerApi.listPlayers).mockResolvedValue([
      person('p1', 'Ann', 'Ash'),
      person('p9', 'Zed', 'Zulu'),
      person('p5', 'Sam', 'Venter'),
    ] as never)
    vi.mocked(resultApi.listGuestNames).mockResolvedValue({
      content: [{ displayName: 'Dewald van Wyk', uses: 3, lastUsed: '2026-10-01T00:00:00Z' }],
      totalElements: 1, totalPages: 1, number: 0, size: 8,
    })
  })

  it("opens on this team's squad, the hinted players first, and picks a player", async () => {
    const { onPickPlayer } = setup({ hints: { p3: '12th man' } })

    const items = await screen.findAllByRole('button', { name: /Ash|Birch|Cedar/ })
    expect(items[0]).toHaveTextContent('Cal Cedar')
    expect(items[0]).toHaveTextContent('12th man')
    expect(squadApi.listSquad).toHaveBeenCalledWith('club-1', 'team-1', 'season-1')

    await userEvent.click(screen.getByRole('button', { name: /Bob Birch/ }))
    expect(onPickPlayer).toHaveBeenCalledWith({ playerProfileId: 'p2', firstName: 'Bob', lastName: 'Birch' })
  })

  it('shows players already on the list disabled with the reason', async () => {
    const { onPickPlayer } = setup({ takenPlayers: { p1: 'Already batting at 3' } })

    const ann = await screen.findByRole('button', { name: /Ann Ash/ })
    expect(ann).toHaveAttribute('aria-disabled', 'true')
    expect(ann).toHaveTextContent('Already batting at 3')
    fireEvent.click(ann)
    expect(onPickPlayer).not.toHaveBeenCalled()
  })

  it('searches the squad as you type', async () => {
    setup()
    await screen.findByRole('button', { name: /Bob Birch/ })
    await userEvent.type(screen.getByRole('textbox', { name: 'Search players' }), 'cal')

    expect(screen.queryByRole('button', { name: /Bob Birch/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cal Cedar/ })).toBeInTheDocument()
  })

  it('Anyone in the club lists the whole roster, filtered locally', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Club' }))

    expect(await screen.findByRole('button', { name: /Zed Zulu/ })).toBeInTheDocument()
    expect(playerApi.listPlayers).toHaveBeenCalledWith('club-1', { includeInactive: false })
    await userEvent.type(screen.getByRole('textbox', { name: 'Search players' }), 'zul')
    expect(screen.queryByRole('button', { name: /Sam Venter/ })).not.toBeInTheDocument()
  })

  it('opens on Anyone in the club when there is no squad to show', async () => {
    setup({ teamId: null })
    expect(await screen.findByRole('button', { name: /Zed Zulu/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "Team squad" })).not.toBeInTheDocument()
  })

  it('adds a guest by name, with the club\'s earlier guest names offered', async () => {
    const { onPickGuest } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Guest' }))
    const name = screen.getByRole('combobox', { name: 'Guest name' })
    await userEvent.type(name, 'Dew')

    expect(await screen.findByRole('option', { name: 'Dewald van Wyk' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'Dewald van Wyk' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add as guest' }))
    expect(onPickGuest).toHaveBeenCalledWith('Dewald van Wyk')
  })

  it('refuses a guest name already on the list', async () => {
    setup({ takenGuests: ['dewald van wyk'] })
    await userEvent.click(screen.getByRole('button', { name: 'Guest' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Guest name' }), 'Dewald  van Wyk')

    expect(screen.getByText('A guest with this name is already on this list.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add as guest' })).toBeDisabled()
  })

  it('offers "Use this player" when the guest name is a registered player\'s', async () => {
    const { onPickPlayer, onPickGuest } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Guest' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Guest name' }), 'sam venter')

    await userEvent.click(await screen.findByRole('button', { name: 'Use this player' }))
    expect(onPickPlayer).toHaveBeenCalledWith({ playerProfileId: 'p5', firstName: 'Sam', lastName: 'Venter' })
    expect(onPickGuest).not.toHaveBeenCalled()
  })

  it('disables "Use this player" when that player is already on the list', async () => {
    setup({ takenPlayers: { p5: 'Already batting at 6' } })
    await userEvent.click(screen.getByRole('button', { name: 'Guest' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Guest name' }), 'Sam Venter')

    expect(await screen.findByRole('button', { name: 'Use this player' })).toBeDisabled()
  })

  it('match-only lists the whole side including the 12th man, disables those already bowling and points to Our batting', async () => {
    const onPickMatchPlayer = vi.fn()
    const onNotListed = vi.fn()
    const matchPlayers = [...Array.from({ length: 11 }, (_, i) => ({ key: `k${i}`, firstName: `Pl${i}`, lastName: 'Xx' })), { key: 'k12', firstName: 'Twelfth', lastName: 'Man' }]
    setup({ matchOnly: true, matchPlayers, takenPlayers: { k0: 'Already bowling' }, hints: { k12: '12th man' }, onPickMatchPlayer, onNotListed })

    expect(await screen.findAllByRole('button', { name: /Xx|Twelfth/ })).toHaveLength(12)
    expect(screen.getByRole('button', { name: /Twelfth Man/ })).toHaveTextContent('12th man')
    expect(screen.getByRole('button', { name: /Pl0 Xx/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('button', { name: 'Team squad' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Twelfth Man/ }))
    expect(onPickMatchPlayer).toHaveBeenCalledWith('k12')
    await userEvent.click(screen.getByRole('button', { name: 'Add them on Teams' }))
    expect(onNotListed).toHaveBeenCalled()
  })

  it('opens on Match squad when given one, and on Team squad with a note when no team was selected', async () => {
    setup({ matchSquad: [{ playerProfileId: 'm1', firstName: 'Mia', lastName: 'Match' }] })
    expect(await screen.findByRole('button', { name: /Mia Match/ })).toBeInTheDocument()
  })

  // docs/specs/104: what an import's file said, the ranked closest players, and the Guest name prefilled.
  describe('for an imported name', () => {
    const suggestion = (id: string, first: string, last: string, score: number) => ({ player: { playerProfileId: id, firstName: first, lastName: last }, score })

    it('shows what the file said and the closest players best first with their similarity, and a tap picks one', async () => {
      const user = userEvent.setup()
      const { onPickPlayer } = setup({
        importedName: 'Dino V',
        suggestions: [suggestion('p2', 'Bob', 'Birch', 0.82), suggestion('p3', 'Cal', 'Cedar', 0.4)],
      })

      expect(await screen.findByText(/File said:/)).toHaveTextContent('Dino V')
      const list = screen.getByRole('list', { name: 'Closest players' })
      const rows = within(list).getAllByRole('button')
      expect(rows[0]).toHaveTextContent('Bob Birch')
      expect(rows[0]).toHaveTextContent('82%')
      expect(rows[1]).toHaveTextContent('Cal Cedar')

      await user.click(rows[0])
      expect(onPickPlayer).toHaveBeenCalledWith({ playerProfileId: 'p2', firstName: 'Bob', lastName: 'Birch' })
    })

    it('greys out a closest player who is already taken, with the reason, and cannot pick them', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      const { onPickPlayer } = setup({
        importedName: 'Dino V',
        suggestions: [suggestion('p2', 'Bob', 'Birch', 0.82)],
        takenPlayers: { p2: 'Already on this side' },
      })

      const row = (await screen.findByRole('list', { name: 'Closest players' })).querySelector('[role="button"]') as HTMLElement
      expect(row).toHaveAttribute('aria-disabled', 'true')
      await user.click(row)
      expect(onPickPlayer).not.toHaveBeenCalled()
    })

    it('prefills the Guest name with the file spelling so keeping a guest is one tap', async () => {
      const user = userEvent.setup()
      setup({ importedName: 'Dino V' })
      await user.click(await screen.findByRole('button', { name: 'Guest' }))
      expect(screen.getByDisplayValue('Dino V')).toBeInTheDocument()
    })

    it('shows no import header for an ordinary pick', async () => {
      setup()
      await screen.findByText('Ann Ash')
      expect(screen.queryByText(/File said:/)).not.toBeInTheDocument()
    })
  })
})
