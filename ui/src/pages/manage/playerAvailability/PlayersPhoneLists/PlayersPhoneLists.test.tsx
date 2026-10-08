import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlayersPhoneLists } from './PlayersPhoneLists'
import { at, makeGame, makePlayer } from '../testData'

// Oct 3 (two games), Oct 5, Oct 6, Oct 7 (one each), then a game with no poll on Oct 8.
const G1 = makeGame({ matchId: 'm1', matchDate: at(10, 3, 9), dayPart: 'MORNING', label: 'Lions v Tigers' })
const G2 = makeGame({ matchId: 'm2', matchDate: at(10, 3, 14), dayPart: 'AFTERNOON', label: 'Lions v Bears' })
const G3 = makeGame({ matchId: 'm3', matchDate: at(10, 5, 9), label: 'Lions v Wolves' })
const G4 = makeGame({ matchId: 'm4', matchDate: at(10, 6, 9), label: 'Lions v Hawks' })
const G5 = makeGame({ matchId: 'm5', matchDate: at(10, 7, 9), label: 'Lions v Eagles' })
const NO_POLL = makeGame({ matchId: 'm6', matchDate: at(10, 8, 9), label: 'Lions v Owls', pollType: null, pollId: null, roundId: null, sectionId: 'section-9' })
const GAMES = [G1, G2, G3, G4, G5, NO_POLL]

const PLAYERS = [
  makePlayer('p1', 'Anton', 'de Villiers', 17, [['m1', 'AVAILABLE', true], ['m2', 'UNSURE'], ['m3', 'AVAILABLE'], ['m4', 'NO_RESPONSE'], ['m5', 'NOT_IN_POLL'], ['m6', 'NOT_IN_POLL']]),
  makePlayer('p2', 'Bob', 'Jones', null, [['m1', 'UNAVAILABLE'], ['m2', 'NO_RESPONSE'], ['m3', 'AVAILABLE'], ['m4', 'AVAILABLE'], ['m5', 'AVAILABLE'], ['m6', 'NOT_IN_POLL']]),
  makePlayer('p3', 'Amy', 'Lee', 4, [['m1', 'NO_RESPONSE'], ['m2', 'AVAILABLE'], ['m3', 'UNSURE'], ['m4', 'UNAVAILABLE'], ['m5', 'UNSURE'], ['m6', 'NOT_IN_POLL']]),
]

// Oct 4, mid-morning: the next game day is Monday 5 Oct.
const NOW = new Date(2026, 9, 4, 10, 0)
// Oct 3 early: the next game day is Saturday, so it opens on the first game of the day.
const SAT_EARLY = new Date(2026, 9, 3, 7, 0)

function renderLists(props: Partial<React.ComponentProps<typeof PlayersPhoneLists>> = {}) {
  return render(
    <MemoryRouter>
      <PlayersPhoneLists games={GAMES} players={PLAYERS} now={NOW} {...props} />
    </MemoryRouter>,
  )
}

const names = () => within(screen.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent)

describe('PlayersPhoneLists', () => {
  describe('switch and By game', () => {
    it('shows By game first, with the By game / By player switch', () => {
      renderLists()

      expect(screen.getByRole('group', { name: 'Players view' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'By game' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'By player' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument()
    })

    it('opens on the first game of the next game day', () => {
      renderLists()

      expect(screen.getByText(/Lions v Wolves · \d\d:\d\d/)).toBeInTheDocument()
      expect(screen.getByText(/Game 3 of 6/)).toBeInTheDocument()
      expect(screen.getByText(/Tomorrow/)).toBeInTheDocument()
    })

    it('opens on the first game of today when today has games (an earlier one has already gone)', () => {
      renderLists({ now: new Date(2026, 9, 3, 15, 0) })

      expect(screen.getByText(/Game 1 of 6/)).toBeInTheDocument()
      expect(screen.getByText(/Today/)).toBeInTheDocument()
    })

    it('opens on the last game when every game is past', () => {
      renderLists({ now: new Date(2026, 11, 1) })

      expect(screen.getByText(/Game 6 of 6/)).toBeInTheDocument()
    })

    it('steps between games with the arrows and stops at the ends', async () => {
      const user = userEvent.setup()
      renderLists({ now: SAT_EARLY })

      expect(screen.getByRole('button', { name: 'Previous game' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Next game' }))
      expect(screen.getByText(/Game 2 of 6/)).toBeInTheDocument()
      expect(screen.getByText(/Lions v Bears/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Previous game' }))
      expect(screen.getByText(/Game 1 of 6/)).toBeInTheDocument()
      for (let i = 0; i < 5; i += 1) await user.click(screen.getByRole('button', { name: 'Next game' }))
      expect(screen.getByText(/Game 6 of 6/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next game' })).toBeDisabled()
    })

    it('steps between games with a horizontal swipe', () => {
      renderLists({ now: SAT_EARLY })
      const selector = screen.getByTestId('game-selector')

      fireEvent.touchStart(selector, { touches: [{ clientX: 250, clientY: 100 }] })
      fireEvent.touchEnd(selector, { changedTouches: [{ clientX: 100, clientY: 104 }] })
      expect(screen.getByText(/Game 2 of 6/)).toBeInTheDocument()

      fireEvent.touchStart(selector, { touches: [{ clientX: 100, clientY: 100 }] })
      fireEvent.touchEnd(selector, { changedTouches: [{ clientX: 250, clientY: 100 }] })
      expect(screen.getByText(/Game 1 of 6/)).toBeInTheDocument()
    })

    it('lists every player with an answer for the game, a status word and a picked dot', () => {
      renderLists({ now: SAT_EARLY })

      const items = within(screen.getByRole('list')).getAllByRole('listitem')
      expect(items).toHaveLength(3)
      expect(items[0]).toHaveTextContent('Anton de VilliersAvailable')
      expect(within(items[0]).getByRole('img', { name: 'Picked for the match' })).toBeInTheDocument()
      expect(items[1]).toHaveTextContent('Bob JonesUnavailable')
      expect(items[2]).toHaveTextContent('Amy LeeNo response')
      expect(screen.getByText('Picked for the match')).toBeInTheDocument()
    })

    it('rows are at least 44 px high', () => {
      renderLists({ now: SAT_EARLY })

      expect(getComputedStyle(within(screen.getByRole('list')).getAllByRole('listitem')[0]).minHeight).toBe('44px')
    })

    it('shows the four counts on the chips; tapping one filters and tapping it again clears', async () => {
      const user = userEvent.setup()
      renderLists({ now: SAT_EARLY })

      expect(screen.getByRole('button', { name: 'Available 1' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Unsure 0' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Unavailable 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'No response 1' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Unavailable 1' }))
      expect(screen.getByRole('button', { name: 'Unavailable 1' })).toHaveAttribute('aria-pressed', 'true')
      expect(names()).toEqual(['Bob JonesUnavailable'])

      await user.click(screen.getByRole('button', { name: 'Unavailable 1' }))
      expect(names()).toHaveLength(3)
    })

    it('says so when a chosen answer has nobody', async () => {
      const user = userEvent.setup()
      renderLists({ now: SAT_EARLY })

      await user.click(screen.getByRole('button', { name: 'Unsure 0' }))
      expect(screen.getByText('No players with this answer.')).toBeInTheDocument()
    })

    it('counts and lists follow the players it is given (search and filters)', () => {
      renderLists({ now: SAT_EARLY, players: [PLAYERS[0]] })

      expect(screen.getByRole('button', { name: 'Available 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Unavailable 0' })).toBeInTheDocument()
      expect(names()).toEqual(['Anton de VilliersAvailable'])
    })

    it('offers to open a poll for a game without one, and shows no chips for it', async () => {
      const user = userEvent.setup()
      renderLists({ now: SAT_EARLY })
      for (let i = 0; i < 5; i += 1) await user.click(screen.getByRole('button', { name: 'Next game' }))

      expect(screen.getByRole('link', { name: 'Open a poll' })).toHaveAttribute('href', expect.stringContaining('/manage/availability/new?type=group&sectionId=section-9&matchId=m6'))
      expect(screen.queryByRole('group', { name: 'Filter by answer' })).not.toBeInTheDocument()
    })

    it('falls back to the opening game, not the first, when a filter drops the selected game', async () => {
      const user = userEvent.setup()
      const view = renderLists()
      await user.click(screen.getByRole('button', { name: 'Next game' }))
      expect(screen.getByText(/Game 4 of 6/)).toBeInTheDocument()

      view.rerender(
        <MemoryRouter>
          <PlayersPhoneLists games={GAMES.filter((game) => game.matchId !== 'm4')} players={PLAYERS} now={NOW} />
        </MemoryRouter>,
      )
      // Opening game (Mon 5 Oct, Lions v Wolves) is game 3 of the remaining 5.
      expect(screen.getByText(/Game 3 of 5/)).toBeInTheDocument()
      expect(screen.getByText(/Lions v Wolves/)).toBeInTheDocument()
    })

    it('keeps the chosen answer chip while stepping between games', async () => {
      const user = userEvent.setup()
      renderLists({ now: SAT_EARLY })

      await user.click(screen.getByRole('button', { name: 'Available 1' }))
      await user.click(screen.getByRole('button', { name: 'Next game' }))
      expect(names()).toEqual(['Amy LeeAvailable'])
    })
  })

  describe('By player', () => {
    async function openByPlayer(props: Partial<React.ComponentProps<typeof PlayersPhoneLists>> = {}) {
      const user = userEvent.setup()
      renderLists(props)
      await user.click(screen.getByRole('button', { name: 'By player' }))
      return user
    }

    it('puts the legend directly under the switch, with the "No poll" wording', async () => {
      await openByPlayer()

      const legend = screen.getByRole('list', { name: 'Legend' })
      expect(within(legend).getByText('No poll')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Players view' }).nextElementSibling).toBe(legend)
    })

    it('shows a strip with the date and match label of the next four games from the next game day', async () => {
      await openByPlayer()

      const strip = screen.getAllByTestId('strip-game')
      expect(strip).toHaveLength(4)
      expect(strip[0]).toHaveTextContent('5 Oct')
      expect(strip[0]).toHaveTextContent('Lions v Wolves')
      expect(strip[3]).toHaveTextContent('8 Oct')
    })

    it('shows a mark per game per player, with an accessible label', async () => {
      await openByPlayer()

      const row = screen.getByRole('button', { name: /Anton de Villiers/ })
      expect(within(row).getAllByRole('img')).toHaveLength(4)
      expect(within(row).getByRole('img', { name: /Lions v Wolves: Available/ })).toBeInTheDocument()
    })

    it('expands a player to the full list of their games, and collapses it again', async () => {
      const user = await openByPlayer()
      const row = screen.getByRole('button', { name: /Anton de Villiers/ })
      expect(row).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByTestId('player-game')).not.toBeInTheDocument()

      await user.click(row)
      expect(row).toHaveAttribute('aria-expanded', 'true')
      const games = screen.getAllByTestId('player-game')
      expect(games).toHaveLength(6)
      expect(games[0]).toHaveTextContent('Lions v Tigers')
      expect(games[0]).toHaveTextContent('Available')
      expect(within(games[0]).getByRole('img', { name: 'Picked for the match' })).toBeInTheDocument()
      expect(games[4]).toHaveTextContent('No poll')

      await user.click(row)
      await waitFor(() => expect(screen.queryByTestId('player-game')).not.toBeInTheDocument())
    })

    it('rows are at least 44 px high', async () => {
      await openByPlayer()

      expect(getComputedStyle(screen.getByRole('button', { name: /Anton de Villiers/ })).minHeight).toBe('44px')
    })

    it('lists only the players it is given, and says so when none', async () => {
      await openByPlayer({ players: [] })

      expect(screen.getByText('No players to show.')).toBeInTheDocument()
    })
  })

  describe('empty states', () => {
    it('shows the grid empty states when there are no games or no polls', () => {
      const { unmount } = renderLists({ games: [], players: [] })
      expect(screen.getByText('No games match these filters')).toBeInTheDocument()
      unmount()

      renderLists({ games: [NO_POLL] })
      expect(screen.getByText('No polls opened yet for these games')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to Availability Polls' })).toBeInTheDocument()
    })
  })

  describe('changing an answer (085 F)', () => {
    const handlers = () => ({ pendingKeys: new Set<string>(), onChange: vi.fn().mockResolvedValue(true) })

    it('By game: the status pill opens the menu and choosing an answer calls the handler', async () => {
      const user = userEvent.setup()
      const change = handlers()
      renderLists({ now: SAT_EARLY, changeAnswer: change })

      const pill = screen.getAllByRole('button', { name: /Bob Jones, Sat 3 Oct Morning, Lions v Tigers: Unavailable/ })[0]
      expect(pill).toHaveAttribute('aria-haspopup', 'menu')
      await user.click(pill)
      expect(screen.getByRole('menuitem', { name: 'Unavailable' })).toHaveClass('Mui-selected')
      await user.click(screen.getByRole('menuitem', { name: 'Available' }))

      const [player, game, status] = change.onChange.mock.calls[0]
      expect([player.playerProfileId, game.matchId, status]).toEqual(['p2', 'm1', 'AVAILABLE'])
    })

    it('By player: a game in an expanded row opens the menu, and a game without a poll stays plain', async () => {
      const user = userEvent.setup()
      const change = handlers()
      renderLists({ now: SAT_EARLY, changeAnswer: change })
      await user.click(screen.getByRole('button', { name: 'By player' }))
      await user.click(screen.getByRole('button', { name: /^Anton de Villiers/ }))

      const games = screen.getAllByTestId('player-game')
      await user.click(within(games[1]).getByRole('button'))
      await user.click(screen.getByRole('menuitem', { name: 'Unavailable' }))
      expect(change.onChange.mock.calls[0][1].matchId).toBe('m2')
      expect(change.onChange.mock.calls[0][2]).toBe('UNAVAILABLE')
      // m5 and m6 are NOT_IN_POLL for Anton: no button.
      expect(within(games[4]).queryByRole('button')).toBeNull()
      expect(within(games[5]).queryByRole('button')).toBeNull()
    })

    it('the change-answer targets are at least 44 x 44 px in both lists', async () => {
      const user = userEvent.setup()
      renderLists({ now: SAT_EARLY, changeAnswer: handlers() })

      const byGame = screen.getAllByRole('button', { name: /Bob Jones, Sat 3 Oct Morning/ })[0]
      expect(getComputedStyle(byGame)).toMatchObject({ minHeight: '44px', minWidth: '44px' })

      await user.click(screen.getByRole('button', { name: 'By player' }))
      await user.click(screen.getByRole('button', { name: /^Anton de Villiers/ }))
      const target = within(screen.getAllByTestId('player-game')[1]).getByRole('button')
      expect(getComputedStyle(target)).toMatchObject({ minHeight: '44px', minWidth: '44px' })
    })

    it('without handlers the pills are plain', () => {
      renderLists({ now: SAT_EARLY })

      expect(within(screen.getByRole('list')).queryAllByRole('button')).toHaveLength(0)
    })
  })
})
