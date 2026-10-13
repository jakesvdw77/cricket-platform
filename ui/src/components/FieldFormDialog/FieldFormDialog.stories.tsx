import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FieldFormDialog } from './FieldFormDialog'

const meta: Meta<typeof FieldFormDialog> = {
  title: 'Components/FieldFormDialog',
  component: FieldFormDialog,
  parameters: { layout: 'padded' },
  // Saving and the "Did you mean" lookup go through React Query.
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

type Story = StoryObj<typeof FieldFormDialog>

export const Open: Story = {}
export const WithTypedName: Story = { args: { initialName: 'Away Park' } }
export const MobileViewport: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
