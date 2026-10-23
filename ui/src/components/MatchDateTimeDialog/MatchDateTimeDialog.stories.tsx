import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MatchDateTimeDialog } from './MatchDateTimeDialog'

const meta: Meta<typeof MatchDateTimeDialog> = {
  title: 'Components/MatchDateTimeDialog',
  component: MatchDateTimeDialog,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { open: true, onClose: () => {}, onSaved: () => {}, clubId: 'club-1', matchId: 'match-1', matchDate: '2026-10-04T08:00:00.000Z' },
}
export default meta

type Story = StoryObj<typeof MatchDateTimeDialog>

export const Default: Story = {}
