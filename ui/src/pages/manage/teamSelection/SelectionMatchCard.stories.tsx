import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SelectionMatchCard } from './SelectionMatchCard'
import { sampleMatches } from './teamSelectionTestUtils'

const matches = sampleMatches()

const meta: Meta<typeof SelectionMatchCard> = {
  title: 'Pages/Manage/TeamSelection/SelectionMatchCard',
  component: SelectionMatchCard,
  parameters: { layout: 'padded' },
  // The card reads its match for directions and the forecast, so the stories need a React Query client; the router comes from preview.
  decorators: [(Story) => <QueryClientProvider client={new QueryClient()}><Story /></QueryClientProvider>],
  args: { clubId: 'club-1', onAnnounce: () => undefined, onShare: () => undefined },
}
export default meta

type Story = StoryObj<typeof SelectionMatchCard>

// docs/specs/137: the Cards view of the Matches tab, one story per status.
export const NotStarted: Story = { args: { match: matches[0], side: matches[0].sides[0] } }
export const InProgress: Story = { args: { match: matches[1], side: matches[1].sides[0] } }
export const ReadyToAnnounce: Story = { args: { match: matches[2], side: matches[2].sides[0] } }
export const Announced: Story = { args: { match: matches[3], side: matches[3].sides[0] } }
