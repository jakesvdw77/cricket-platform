import type { Meta, StoryObj } from '@storybook/react-vite'
import { SelectionMatchesTable } from './SelectionMatchesTable'
import { makeMatch, makeSide, sampleMatches } from './teamSelectionTestUtils'

const meta: Meta<typeof SelectionMatchesTable> = {
  title: 'Pages/Manage/TeamSelection/SelectionMatchesTable',
  component: SelectionMatchesTable,
  parameters: { layout: 'padded' },
  args: { onAnnounce: () => undefined },
}
export default meta

type Story = StoryObj<typeof SelectionMatchesTable>

// docs/specs/093: one match per status (not started, in progress, ready to announce, announced), zebra rows.
export const Default: Story = { args: { matches: sampleMatches() } }

// A derby shows one row per club side.
export const Derby: Story = {
  args: {
    matches: [
      makeMatch({
        matchId: 'derby',
        sides: [
          makeSide({ sideId: 's-a', teamName: 'Riverside Vets A', opponentName: 'Riverside Vets B', status: 'IN_PROGRESS', pickedCount: 9 }),
          makeSide({ sideId: 's-b', teamId: 'team-2', teamName: 'Riverside Vets B', opponentName: 'Riverside Vets A', home: false, status: 'NOT_STARTED' }),
        ],
      }),
    ],
  },
}

export const Announcing: Story = { args: { matches: sampleMatches(), announcingSideId: 'side-3' } }
