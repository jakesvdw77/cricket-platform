import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SubscriptionForm } from './SubscriptionForm'

const meta: Meta<typeof SubscriptionForm> = {
  title: 'Components/SubscriptionForm',
  component: SubscriptionForm,
  parameters: { layout: 'padded' },
  // SubscriptionForm's <form> renders with display: 'contents' so its fields become direct
  // grid items of the parent grid — decorate with the same grid RecordFormScreen provides in
  // the real app, and wrap in a QueryClientProvider since the Club/Product pickers are backed
  // by React Query (same pattern as ProductForm.stories.tsx, plus the query client this form
  // additionally needs).
  decorators: [
    (Story) => {
      const queryClient = new QueryClient()
      return (
        <QueryClientProvider client={queryClient}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Story />
          </Box>
        </QueryClientProvider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof SubscriptionForm>

export const Create: Story = {
  args: {
    onSubmit: () => undefined,
  },
}

export const Edit: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: {
      clubId: 'club-1',
      clubLabel: 'Riverside CC',
      productId: 'product-1',
      startDate: '2026-01-01',
      endDate: null,
    },
  },
}

// docs/specs/008-product-catalog.md's Test Plan pattern — a story at each of 375/768/1280,
// applied here too so the field grid's single/two-column reflow is visible per-component.
export const MobileViewport: Story = {
  args: Edit.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Edit.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Edit.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
