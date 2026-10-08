import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { userEvent, within } from 'storybook/test'
import { PlayersPhoneLists } from './PlayersPhoneLists'
import { makeGame, makePlayer } from '../testData'

// Dates are built in local time. `now` is fixed so the story always opens on Mon 5 Oct, the next game day.
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute).toISOString()
const NOW = new Date(2026, 9, 4, 10, 0)

const GAMES = [
  makeGame({ matchId: 'm1', matchDate: at(10, 3, 9), label: 'Villagers 1 v POHBS' }),
  makeGame({ matchId: 'm2', matchDate: at(10, 5, 9, 15), label: 'Villagers 1 v TBC' }),
  makeGame({ matchId: 'm3', matchDate: at(10, 5, 14, 30), dayPart: 'AFTERNOON', label: 'Villagers 2 v CBC 1' }),
  makeGame({ matchId: 'm4', matchDate: at(10, 10, 9), label: 'Villagers 1 v CBC' }),
  makeGame({ matchId: 'm5', matchDate: at(10, 17, 9), label: 'Villagers 3 v Rovers', pollType: null, pollId: null, roundId: null }),
]

const PLAYERS = [
  makePlayer('p1', 'Anton', 'de Villiers', 17, [['m1', 'AVAILABLE'], ['m2', 'AVAILABLE'], ['m3', 'NOT_IN_POLL'], ['m4', 'AVAILABLE'], ['m5', 'NOT_IN_POLL']]),
  makePlayer('p2', 'Brain', 'Best', null, [['m1', 'AVAILABLE'], ['m2', 'AVAILABLE', true], ['m3', 'NOT_IN_POLL'], ['m4', 'UNSURE'], ['m5', 'NOT_IN_POLL']]),
  makePlayer('p3', 'Emile', 'van der Merwe', 4, [['m1', 'UNAVAILABLE'], ['m2', 'UNAVAILABLE'], ['m3', 'NO_RESPONSE'], ['m4', 'NO_RESPONSE'], ['m5', 'NOT_IN_POLL']]),
  makePlayer('p4', 'Jaco', 'van der Westhuizen', 9, [['m1', 'NO_RESPONSE'], ['m2', 'NO_RESPONSE'], ['m3', 'AVAILABLE'], ['m4', 'UNAVAILABLE'], ['m5', 'NOT_IN_POLL']]),
]

// The router comes from the Storybook preview; the lists are a phone layout, so they sit in a phone-wide column.
const meta: Meta<typeof PlayersPhoneLists> = {
  title: 'Pages/Manage/PlayersPhoneLists',
  component: PlayersPhoneLists,
  parameters: { layout: 'padded' },
  args: { games: GAMES, players: PLAYERS, now: NOW },
  decorators: [
    (StoryComponent) => (
      <Box sx={{ maxWidth: 375 }}>
        <StoryComponent />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PlayersPhoneLists>

export const ByGame: Story = {}

// Taps "Unavailable" so the chip is on and the list is filtered.
export const ByGameFiltered: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /^Unavailable/ }))
  },
}

export const ByPlayer: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'By player' }))
  },
}

// A player's row opened to the full list of their games.
export const ByPlayerExpanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'By player' }))
    await userEvent.click(canvas.getByRole('button', { name: /Emile van der Merwe/ }))
  },
}

export const NoPlayers: Story = { args: { players: [] } }

export const NoGames: Story = { args: { games: [], players: [] } }

export const NoPollsYet: Story = {
  args: { games: [makeGame({ matchId: 'm9', pollType: null, pollId: null, roundId: null })], players: [] },
}
