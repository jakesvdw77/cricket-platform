import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicAvailabilityFlow } from './PublicAvailabilityFlow'
import type { PublicPollAdapter, PublicPollContext } from './adapters'

const context: PublicPollContext = {
  clubId: 'club-1',
  open: true,
  brandName: 'Irene Villagers',
  title: 'Over 40 fixtures',
  subtitle: 'Over 40s · 2 matches',
  details: [],
  scheduledCloseAt: '2030-10-14T07:15:00Z',
  slots: [
    { key: 'w1', windowId: 'w1', label: 'Thu 15 Oct · Morning', matches: ['Villagers 1 v POHBS'], open: true },
    { key: 'w2', windowId: 'w2', label: 'Thu 15 Oct · Afternoon', matches: ['Villagers 1 v TBC'], open: true },
  ],
}

// A story-only adapter: any details verify, answers are echoed back. No network.
function adapterFor(overrides: Partial<PublicPollContext>): PublicPollAdapter {
  return {
    kind: 'group',
    queryKey: (id) => ['story', id, JSON.stringify(overrides)],
    load: async () => ({ ...context, ...overrides }),
    verify: async (_id, body) => ({
      status: 'VERIFIED',
      playerId: 'p1',
      firstName: body.firstName,
      lastName: body.lastName,
      token: 'story-token',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }),
    getAnswers: async () => ({ answers: [] }),
    putAnswers: async (_id, _playerId, _token, answers) => ({ answers }),
  }
}

const meta: Meta<typeof PublicAvailabilityFlow> = {
  title: 'Components/PublicAvailability/PublicAvailabilityFlow',
  component: PublicAvailabilityFlow,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PublicAvailabilityFlow>

export const OpenGroupPoll: Story = { args: { id: 'story-open', adapter: adapterFor({}) } }
export const ClosedPoll: Story = { args: { id: 'story-closed', adapter: adapterFor({ open: false }) } }
