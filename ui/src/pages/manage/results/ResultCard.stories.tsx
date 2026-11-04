import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResultCard } from './ResultCard'
import { makeListItem } from './resultTestUtils'

const published = makeListItem({ id: 'match-1' })
const draft = makeListItem({ id: 'match-2', awayTeamName: 'Hillcrest CC' }, { id: 'result-2', matchId: 'match-2', status: 'DRAFT', publishedAt: null })

// The kebab does not need data, but the card sits under a router (from preview) and React Query for the publish and share hooks upstream.
const meta: Meta<typeof ResultCard> = {
  title: 'Pages/Manage/Results/ResultCard',
  component: ResultCard,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <QueryClientProvider client={new QueryClient()}><Story /></QueryClientProvider>],
  args: { teamsById: new Map(), leaguesById: new Map(), seasonsById: new Map(), onPublish: () => undefined, onShare: () => undefined },
}
export default meta

type Story = StoryObj<typeof ResultCard>

// docs/specs/138: a published result (Share Result enabled, Edit Result disabled with its reason) and a draft (quick Publish Result).
export const Published: Story = { args: { item: published } }
export const Draft: Story = { args: { item: draft } }
