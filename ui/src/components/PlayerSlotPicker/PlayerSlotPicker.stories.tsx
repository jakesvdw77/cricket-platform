import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayerSlotPicker } from './PlayerSlotPicker'

// The picker reads the squad, the roster and the guest names through React Query; the story seeds the cache so it needs
// no backend.
function seededClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const person = (id: string, firstName: string, lastName: string) => ({ id, playerProfileId: id, firstName, lastName })
  client.setQueryData(
    ['managed-club', 'club-1', 'teams', 'team-1', 'seasons', 'season-1', 'squad'],
    [person('p1', 'Ann', 'Ash'), person('p2', 'Bob', 'Birch'), person('p3', 'Sam', 'Venter'), person('p4', 'Sam', 'van der Walton')],
  )
  client.setQueryData(['managed-club', 'club-1', 'players', { includeInactive: false }], [
    person('p1', 'Ann', 'Ash'),
    person('p2', 'Bob', 'Birch'),
    person('p9', 'Zed', 'Zulu'),
  ])
  return client
}

const meta: Meta<typeof PlayerSlotPicker> = {
  title: 'Components/PlayerSlotPicker',
  component: PlayerSlotPicker,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={seededClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onClose: () => {},
    clubId: 'club-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    title: 'Swap player',
    onPickPlayer: () => {},
    onPickGuest: () => {},
  },
}
export default meta

type Story = StoryObj<typeof PlayerSlotPicker>

export const Squad: Story = {
  args: { hints: { p4: '12th man' }, takenPlayers: { p1: 'Already batting at 1' } },
}

export const NoSquad: Story = { args: { teamId: null } }

// docs/specs/104: a name an import could not place: "File said" at the top and the closest players as one-tap picks.
export const ImportedUnresolved: Story = {
  args: {
    title: 'Link to a registered player',
    allowGuest: false,
    importedName: 'Sam V',
    suggestions: [
      { player: { playerProfileId: 'p3', firstName: 'Sam', lastName: 'Venter' }, score: 0.86 },
      { player: { playerProfileId: 'p4', firstName: 'Sam', lastName: 'van der Walton' }, score: 0.81 },
    ],
  },
}
