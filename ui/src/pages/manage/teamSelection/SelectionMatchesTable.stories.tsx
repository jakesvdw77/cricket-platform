import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SelectionMatchesTable } from './SelectionMatchesTable'
import { makeMatch, makeSide, sampleMatches } from './teamSelectionTestUtils'

const meta: Meta<typeof SelectionMatchesTable> = {
  title: 'Pages/Manage/TeamSelection/SelectionMatchesTable',
  component: SelectionMatchesTable,
  parameters: { layout: 'padded' },
  // The card reads its match for directions and the forecast, so the stories need a React Query client; the router comes from preview.
  decorators: [(Story) => <QueryClientProvider client={new QueryClient()}><Story /></QueryClientProvider>],
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

// docs/specs/137: the toolbar fused into the table's card (one card, one hairline), and the empty message in its place.
export const WithToolbar: Story = {
  args: { matches: sampleMatches(), toolbar: <div style={{ padding: 8 }}>Filters, View Entire Season and Cards | List go here</div> },
}

export const EmptyWithToolbar: Story = {
  args: { matches: [], toolbar: <div style={{ padding: 8 }}>Filters go here</div>, empty: <div style={{ padding: 24, textAlign: 'center' }}>No upcoming matches</div> },
}
