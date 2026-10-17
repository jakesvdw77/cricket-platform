import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerSlotPicker } from './PlayerSlotPicker'
import type { PlayerSlotPickerProps } from './PlayerSlotPicker'
import * as playerApi from '../../api/playerApi'
import * as leagueApi from '../../api/leagueApi'
import * as sectionApi from '../../api/sectionApi'
import * as squadApi from '../../api/teamSquadApi'
import * as resultApi from '../../api/matchResultApi'
import { resetPlayerNameModeForTests } from '../../hooks/usePlayerNameMode'

vi.mock('../../api/playerApi', () => ({ listPlayers: vi.fn(), createPlayer: vi.fn(), linkPlayerSection: vi.fn() }))
vi.mock('../../api/leagueApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/leagueApi')>()),
  listLeagues: vi.fn(),
  getLeagueAgeReference: vi.fn(),
}))
vi.mock('../../api/sectionApi', () => ({ listSections: vi.fn() }))
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

  describe('Club tab scope (clubScope)', () => {
    afterEach(() => vi.clearAllMocks())

    const dated = (id: string, firstName: string, lastName: string, dateOfBirth: string | null) => ({ ...person(id, firstName, lastName), dateOfBirth })

    beforeEach(() => {
      vi.mocked(sectionApi.listSections).mockResolvedValue([
        { id: 'sec-0', name: 'Juniors', parentSectionId: null, minAge: null, maxAge: null },
        { id: 'sec-1', name: 'Under 15', parentSectionId: 'sec-0', minAge: null, maxAge: 15 },
      ] as never)
      vi.mocked(leagueApi.listLeagues).mockResolvedValue([{ id: 'lg-1', name: 'Diamond League', minAge: 13, maxAge: 15 }] as never)
      vi.mocked(leagueApi.getLeagueAgeReference).mockResolvedValue({ referenceDate: '2026-12-31', source: 'CUTOFF', leagueStart: '2026-09-01', leagueStartSource: 'FIRST_MATCH' })
      vi.mocked(playerApi.listPlayers).mockImplementation(((_club: string, params?: { sectionId?: string }) =>
        Promise.resolve(
          params?.sectionId
            ? [
                dated('a', 'Ok', 'Youngest', '2013-12-31'),
                dated('b', 'Too', 'Young', '2014-01-01'),
                dated('c', 'Ok', 'Oldest', '2011-01-01'),
                dated('d', 'Too', 'Old', '2010-12-31'),
                dated('e', 'No', 'Birthday', null),
              ]
            : [...[1, 2, 3, 4, 5].map((n) => dated(`s${n}`, 'In', `Section${n}`, '2013-01-01')), dated('x', 'Other', 'Section', '2013-01-01')],
        )) as never)
    })

    const openClub = async (props: Partial<PlayerSlotPickerProps>) => {
      const user = userEvent.setup()
      setup(props)
      await user.click(await screen.findByRole('button', { name: 'Club' }))
      return user
    }

    it('asks for the section and filters by age on the reference date, both limits inclusive', async () => {
      await openClub({ clubScope: { sectionId: 'sec-1', leagueId: 'lg-1' } })
      expect(await screen.findByText('Ok Youngest')).toBeInTheDocument()
      expect(screen.getByText('Ok Oldest')).toBeInTheDocument()
      for (const hidden of ['Too Young', 'Too Old', 'No Birthday', 'Other Section']) expect(screen.queryByText(hidden)).not.toBeInTheDocument()
      expect(playerApi.listPlayers).toHaveBeenCalledWith('club-1', { includeInactive: false, sectionId: 'sec-1' })
      expect(leagueApi.getLeagueAgeReference).toHaveBeenCalledWith('club-1', 'lg-1', 'season-1')
    })

    it('explains the filter and counts what is hidden', async () => {
      await openClub({ clubScope: { sectionId: 'sec-1', leagueId: 'lg-1' } })
      expect(await screen.findByTestId('club-scope-caption')).toHaveTextContent('Showing players in Juniors > Under 15 who are eligible for Diamond League (aged 13 to 15 on 31 Dec 2026).')
      // 6 in the club, 2 shown.
      expect(screen.getByTestId('club-scope-hidden')).toHaveTextContent('4 players are hidden: other sections, outside the age range or without a date of birth.')
    })

    it('shows the section only, with no-date-of-birth players, when no age rule applies', async () => {
      vi.mocked(leagueApi.listLeagues).mockResolvedValue([{ id: 'lg-1', name: 'Diamond League', minAge: null, maxAge: null }] as never)
      vi.mocked(sectionApi.listSections).mockResolvedValue([{ id: 'sec-1', name: 'Seniors', parentSectionId: null, minAge: null, maxAge: null }] as never)
      await openClub({ clubScope: { sectionId: 'sec-1', leagueId: 'lg-1' } })
      expect(await screen.findByText('No Birthday')).toBeInTheDocument()
      expect(screen.getByText('Too Old')).toBeInTheDocument()
      expect(screen.getByTestId('club-scope-caption')).toHaveTextContent('Showing players in Seniors.')
    })

    it("falls back to the section's age limits when the league sets none, and to the section only when the lookups fail", async () => {
      vi.mocked(leagueApi.listLeagues).mockResolvedValue([{ id: 'lg-1', name: 'Diamond League', minAge: null, maxAge: null }] as never)
      await openClub({ clubScope: { sectionId: 'sec-1', leagueId: 'lg-1' } })
      // Section Under 15: maxAge 15 only, so the too-young player is eligible again.
      expect(await screen.findByText('Too Young')).toBeInTheDocument()
      expect(screen.queryByText('Too Old')).not.toBeInTheDocument()
    })

    it('keeps the section filter when the reference lookup fails', async () => {
      vi.mocked(leagueApi.getLeagueAgeReference).mockRejectedValue(new Error('boom'))
      await openClub({ clubScope: { sectionId: 'sec-1', leagueId: 'lg-1' } })
      expect(await screen.findByTestId('club-scope-caption')).toHaveTextContent('Showing players in Juniors > Under 15')
      expect(screen.queryByText('Other Section')).not.toBeInTheDocument()
    })

    it('shows no club list, only a message, when the side has no section', async () => {
      await openClub({ clubScope: { sectionId: null } })
      expect(await screen.findByText('Choose the team for this match first.')).toBeInTheDocument()
      expect(screen.queryByText('Other Section')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Search players')).not.toBeInTheDocument()
    })

    it('says there is nobody eligible and still offers New player and Guest', async () => {
      vi.mocked(playerApi.listPlayers).mockImplementation(((_c: string, params?: { sectionId?: string }) => Promise.resolve(params?.sectionId ? [] : [])) as never)
      await openClub({ clubScope: { sectionId: 'sec-1', leagueId: 'lg-1' }, newPlayer: { name: 'Jan Berg', sectionId: 'sec-1', leagueId: 'lg-1', seasonId: 'season-1' } })
      expect(await screen.findByText('No eligible players. Create a new player or add them as a guest.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'New player' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Guest' })).toBeInTheDocument()
    })

    it('keeps players already on the list marked and disabled', async () => {
      await openClub({ clubScope: { sectionId: 'sec-1', leagueId: 'lg-1' }, takenPlayers: { a: 'Already on the list' } })
      expect(await screen.findByText('Already on the list')).toBeInTheDocument()
    })

    it('lists the whole club as before without clubScope', async () => {
      await openClub({})
      expect(await screen.findByText('Other Section')).toBeInTheDocument()
      expect(playerApi.listPlayers).toHaveBeenCalledWith('club-1', { includeInactive: false })
    })
  })

  describe('New player tab', () => {
    it('is only there when newPlayer is passed, and the other tabs are unchanged', async () => {
      setup()
      await screen.findByText('Ann Ash')
      expect(screen.queryByRole('button', { name: 'New player' })).not.toBeInTheDocument()
    })

    it('prefills the name from the guest, requires a date of birth, and does not create without it', async () => {
      const user = userEvent.setup()
      setup({ newPlayer: { name: 'Jan van der Berg', sectionId: 'sec-1' }, allowGuest: false })
      await user.click(await screen.findByRole('button', { name: 'New player' }))
      expect(screen.getByLabelText('First name')).toHaveValue('Jan')
      expect(screen.getByLabelText('Last name')).toHaveValue('van der Berg')

      await user.click(screen.getByRole('button', { name: 'Create and link' }))
      expect(await screen.findByText('Date of birth is required')).toBeInTheDocument()
      expect(playerApi.createPlayer).not.toHaveBeenCalled()
    })

    it("reads the league's limits and the server's reference date for the date of birth guidance", async () => {
      const user = userEvent.setup()
      vi.mocked(sectionApi.listSections).mockResolvedValue([{ id: 'sec-1', name: 'U15', minAge: null, maxAge: 15 }] as never)
      vi.mocked(leagueApi.listLeagues).mockResolvedValue([{ id: 'lg-1', name: 'League', minAge: null, maxAge: null }] as never)
      vi.mocked(leagueApi.getLeagueAgeReference).mockResolvedValue({ referenceDate: '2020-12-31', source: 'CUTOFF', leagueStart: '2020-09-01', leagueStartSource: 'FIRST_MATCH' })
      setup({ newPlayer: { name: 'Jan Berg', sectionId: 'sec-1', leagueId: 'lg-1', seasonId: 'season-1' }, allowGuest: false })
      expect(leagueApi.getLeagueAgeReference).not.toHaveBeenCalled()
      await user.click(await screen.findByRole('button', { name: 'New player' }))

      expect(await screen.findByText('Under 15 on 31 Dec 2020: born on or after 1 Jan 2006')).toBeInTheDocument()
      expect(leagueApi.listLeagues).toHaveBeenCalledWith('club-1')
      expect(leagueApi.getLeagueAgeReference).toHaveBeenCalledWith('club-1', 'lg-1', 'season-1')
    })

    it('judges ages today when the reference lookup fails', async () => {
      const user = userEvent.setup()
      vi.mocked(sectionApi.listSections).mockResolvedValue([{ id: 'sec-1', name: 'U15', minAge: null, maxAge: 15 }] as never)
      vi.mocked(leagueApi.listLeagues).mockResolvedValue([{ id: 'lg-1', name: 'League', minAge: null, maxAge: null }] as never)
      vi.mocked(leagueApi.getLeagueAgeReference).mockRejectedValue(new Error('boom'))
      setup({ newPlayer: { name: 'Jan Berg', sectionId: 'sec-1', leagueId: 'lg-1', seasonId: 'season-1' }, allowGuest: false })
      await user.click(await screen.findByRole('button', { name: 'New player' }))

      expect(await screen.findByText(/^Under 15: born on or after /)).toBeInTheDocument()
      await vi.waitFor(() => expect(leagueApi.getLeagueAgeReference).toHaveBeenCalled())
    })

    it('does not look up the league or the reference date when none was passed, or without a season', async () => {
      const user = userEvent.setup()
      vi.mocked(leagueApi.listLeagues).mockClear()
      vi.mocked(leagueApi.getLeagueAgeReference).mockClear()
      setup({ newPlayer: { name: 'Jan Berg', leagueId: 'lg-1' }, allowGuest: false })
      await user.click(await screen.findByRole('button', { name: 'New player' }))
      await screen.findByLabelText('Date of birth')
      expect(leagueApi.getLeagueAgeReference).not.toHaveBeenCalled()
    })

    it('does not look up the league when none was passed', async () => {
      const user = userEvent.setup()
      vi.mocked(leagueApi.listLeagues).mockClear()
      vi.mocked(leagueApi.getLeagueAgeReference).mockClear()
      setup({ newPlayer: { name: 'Jan Berg' }, allowGuest: false })
      await user.click(await screen.findByRole('button', { name: 'New player' }))
      await screen.findByLabelText('Date of birth')
      expect(leagueApi.listLeagues).not.toHaveBeenCalled()
      expect(leagueApi.getLeagueAgeReference).not.toHaveBeenCalled()
    })

    it('creates the player, tags the section, and picks the new player in one step', async () => {
      const user = userEvent.setup()
      vi.mocked(playerApi.createPlayer).mockResolvedValue({ id: 'new-1', firstName: 'Jan', lastName: 'van der Berg' } as never)
      vi.mocked(playerApi.linkPlayerSection).mockResolvedValue(undefined)
      const { onPickPlayer } = setup({ newPlayer: { name: 'Jan van der Berg', sectionId: 'sec-1' }, allowGuest: false })
      await user.click(await screen.findByRole('button', { name: 'New player' }))
      await user.type(screen.getByLabelText('Date of birth'), '2010-04-12')
      await user.click(screen.getByRole('button', { name: 'Create and link' }))

      await vi.waitFor(() => expect(onPickPlayer).toHaveBeenCalledWith({ playerProfileId: 'new-1', firstName: 'Jan', lastName: 'van der Berg' }))
      expect(playerApi.createPlayer).toHaveBeenCalledWith('club-1', expect.objectContaining({ firstName: 'Jan', lastName: 'van der Berg', dateOfBirth: '2010-04-12' }))
      expect(playerApi.linkPlayerSection).toHaveBeenCalledWith('club-1', 'new-1', 'sec-1')
    })

    it('shows a server error inline and leaves the guest unlinked', async () => {
      const user = userEvent.setup()
      vi.mocked(playerApi.createPlayer).mockRejectedValue(
        Object.assign(new Error('bad'), { isAxiosError: true, response: { status: 409, data: { detail: 'This player already exists.' } } }),
      )
      const { onPickPlayer } = setup({ newPlayer: { name: 'Jan Berg' }, allowGuest: false })
      await user.click(await screen.findByRole('button', { name: 'New player' }))
      await user.type(screen.getByLabelText('Date of birth'), '2010-04-12')
      await user.click(screen.getByRole('button', { name: 'Create and link' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('This player already exists.')
      expect(onPickPlayer).not.toHaveBeenCalled()
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
