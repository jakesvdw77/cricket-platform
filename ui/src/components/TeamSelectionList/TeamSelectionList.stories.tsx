import type { Meta, StoryObj } from '@storybook/react-vite'
import { TeamSelectionList } from './TeamSelectionList'
import type { TeamSelectionPlayer } from './TeamSelectionList'

const meta: Meta<typeof TeamSelectionList> = {
  title: 'Components/TeamSelectionList',
  component: TeamSelectionList,
  parameters: { layout: 'padded' },
  args: {
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
    limits: { battingPlaces: 11, twelfthManAllowed: true, maxSelected: 12 },
    onReorder: () => {},
    onSetCaptain: () => {},
    onSetWicketKeeper: () => {},
    onMakeTwelfthMan: () => {},
    onChangeRole: () => {},
    onRemove: () => {},
  },
}
export default meta

type Story = StoryObj<typeof TeamSelectionList>

function player(id: string, name: string, battingOrder: number | null, overrides: Partial<TeamSelectionPlayer> = {}): TeamSelectionPlayer {
  return { playerProfileId: id, name, battingOrder, role: 'BATSMAN', availability: 'AVAILABLE', alsoIn: null, ...overrides }
}

const ORDERED = [
  player('1', 'Liam Carter', 1),
  player('2', 'Jaden Brooks', 2, { role: 'ALL_ROUNDER' }),
  player('3', 'Mark Ellis', 3, { role: 'BOWLER' }),
  player('4', 'Sam Patel', 4),
]

export const Default: Story = {
  args: { players: ORDERED, captainPlayerId: '1', wicketKeeperPlayerId: '2' },
}

export const Empty: Story = { args: { players: [] } }

export const WithWaitingPlayersAndTwelfthMan: Story = {
  args: {
    players: [...ORDERED, player('5', 'Noah Price', null), player('6', 'Tom Reed', null)],
    twelfthManPlayerId: '6',
    captainPlayerId: '1',
  },
}

export const AvailabilityIcons: Story = {
  args: {
    players: [
      player('1', 'Liam Carter', 1, { availability: 'UNSURE' }),
      player('2', 'Jaden Brooks', 2, { availability: 'NO_RESPONSE' }),
      player('3', 'Mark Ellis', 3, { availability: 'NOT_POLLED' }),
      player('4', 'Sam Patel', 4, { availability: 'UNAVAILABLE' }),
      player('5', 'Noah Price', 5, { alsoIn: '2nd XI' }),
    ],
  },
}

export const AllPlacesFull: Story = {
  args: {
    players: [...ORDERED, player('5', 'Noah Price', null)],
    limits: { battingPlaces: 4, twelfthManAllowed: true, maxSelected: 5 },
  },
}

export const Announced: Story = {
  args: { players: ORDERED, captainPlayerId: '1', dragDisabled: true },
}
