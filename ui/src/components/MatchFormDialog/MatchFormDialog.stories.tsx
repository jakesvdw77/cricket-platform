import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MatchFormDialog } from './MatchFormDialog'

const meta: Meta<typeof MatchFormDialog> = {
  title: 'Components/MatchFormDialog',
  component: MatchFormDialog,
  parameters: { layout: 'padded' },
  // The form's lists and saving go through React Query.
  decorators: [
    (StoryComponent) => {
      const queryClient = new QueryClient()
      return (
        <QueryClientProvider client={queryClient}>
          <StoryComponent />
        </QueryClientProvider>
      )
    },
  ],
  args: { open: true, clubId: 'club-1', onClose: () => undefined, onCreated: () => undefined },
}
export default meta

type Story = StoryObj<typeof MatchFormDialog>

export const Open: Story = {}
export const WithSuggestedValues: Story = {
  args: {
    hint: 'Filled in from the file. Check each box.',
    initialValues: { homeTeamName: 'Pretoria A', awayTeamName: 'Riverside CC', matchDate: '2026-10-11T11:00:00.000Z', venue: 'Main Oval' },
  },
}
export const MobileViewport: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
