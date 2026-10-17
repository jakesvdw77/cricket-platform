import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShareResultDialog } from './ShareResultDialog'
import { makeMatch, makeResult } from '../../pages/manage/results/resultTestUtils'

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const meta: Meta<typeof ShareResultDialog> = {
  title: 'Components/ShareResultDialog',
  component: ShareResultDialog,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onClose: () => {},
    clubId: 'club-1',
    match: makeMatch({ id: 'match-1', homeTeamId: 'team-1' }),
    result: makeResult(),
    teamsById: new Map(),
  },
}
export default meta

type Story = StoryObj<typeof ShareResultDialog>

export const Default: Story = {}
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }
