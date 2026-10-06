import type { Meta, StoryObj } from '@storybook/react-vite'
import { SelectPlayersDialog } from './SelectPlayersDialog'
import type { SelectionPool, SelectionPoolEntry } from '../../api/matchSelectionApi'

const meta: Meta<typeof SelectPlayersDialog> = {
  title: 'Components/SelectPlayersDialog',
  component: SelectPlayersDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    teamName: 'Villagers 1',
    kickoffLabel: 'Sat, 3 Oct, 10:00',
    maxSelected: 12,
    initialSelectedIds: [],
    poolLoading: false,
    poolError: false,
    source: 'squad',
    onSourceChange: () => {},
    previousMatches: [],
    previousMatchesLoading: false,
    previousMatchId: null,
    onPreviousMatchChange: () => {},
    previousOrder: null,
    previousOrderLoading: false,
    search: '',
    onSearchChange: () => {},
    onApply: async () => ({ ok: true }),
    onRelease: async () => {},
    onAddNewPlayer: () => {},
    onSetAnswer: async () => {},
    onClose: () => {},
  },
}
export default meta

type Story = StoryObj<typeof SelectPlayersDialog>

function entry(id: string, firstName: string, lastName: string, overrides: Partial<SelectionPoolEntry> = {}): SelectionPoolEntry {
  return {
    playerProfileId: id,
    firstName,
    lastName,
    jerseyNumber: null,
    availability: 'AVAILABLE',
    selected: false,
    selectable: true,
    reason: null,
    reasonText: null,
    taken: null,
    ...overrides,
  }
}

function pool(entries: SelectionPoolEntry[], kind: 'NONE' | 'SQUAD' | 'GROUP' = 'SQUAD'): SelectionPool {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    sideId: 'side-1',
    basis: 'ROSTER',
    wholeSection: false,
    coveringPoll: { kind, pollId: kind === 'SQUAD' ? 'poll-1' : null, roundId: kind === 'GROUP' ? 'round-1' : null, matchId: 'match-1' },
    truncated: false,
    entries,
  }
}

const TAKEN = {
  teamId: 'team-2',
  teamName: 'Villagers 2',
  matchId: 'match-2',
  matchDate: '2026-10-03T09:00:00Z',
  sideId: 'side-2',
  sameMatch: false,
  announced: false,
  canRelease: true,
}

const EVERY_GROUP = pool([
  entry('1', 'Liam', 'Carter'),
  entry('2', 'Noah', 'Price', { availability: 'NOT_POLLED' }),
  entry('3', 'Sam', 'Patel', { availability: 'UNSURE', selected: true, selectable: false, reason: 'NOT_CONFIRMED' }),
  entry('4', 'Dee', 'Dale', { availability: 'NO_RESPONSE', selectable: false, reason: 'NOT_CONFIRMED', reasonText: "Dee hasn't confirmed he is available for this match. Set his answer to Available first." }),
  entry('5', 'Jaden', 'Brooks', { selectable: false, reason: 'TAKEN_FOR_SLOT', taken: TAKEN }),
  entry('6', 'Mark', 'Ellis', { availability: 'UNAVAILABLE', selectable: false, reason: 'SAID_UNAVAILABLE' }),
])

export const Default: Story = {
  args: { pool: EVERY_GROUP, initialSelectedIds: ['3'] },
}

export const Loading: Story = {
  args: { pool: undefined, poolLoading: true },
}

export const LoadError: Story = {
  args: { pool: undefined, poolError: true },
}

export const GroupPoll: Story = {
  args: { pool: pool(EVERY_GROUP.entries, 'GROUP') },
}

export const TeamIsFull: Story = {
  args: {
    maxSelected: 2,
    initialSelectedIds: ['1', '2'],
    pool: pool([entry('1', 'Liam', 'Carter', { selected: true }), entry('2', 'Noah', 'Price', { selected: true }), entry('7', 'Tom', 'Reed')]),
  },
}

export const FromPreviousMatch: Story = {
  args: {
    source: 'previous',
    pool: EVERY_GROUP,
    previousMatches: [{ id: 'prev', label: '26/09/2026 — vs Hawks' }],
    previousMatchId: 'prev',
    previousOrder: ['2', '1'],
  },
}

export const NoPlayers: Story = {
  args: { pool: pool([]) },
}
