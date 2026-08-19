import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClubPicker } from './ClubPicker'

const meta: Meta<typeof ClubPicker> = {
  title: 'Components/ClubPicker',
  component: ClubPicker,
  parameters: { layout: 'padded' },
  // ClubPicker is backed by React Query (searches GET /platform/clubs on focus) — wrap in a
  // QueryClientProvider, same pattern as SubscriptionForm.stories.tsx, and decorate with the
  // same field-grid RecordFormScreen provides in the real app.
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

type Story = StoryObj<typeof ClubPicker>

export const Search: Story = {
  args: {
    value: null,
    onChange: () => undefined,
  },
}

export const Create: Story = {
  args: {
    value: { mode: 'new', name: 'Riverside CC', slug: 'riverside-cc' },
    onChange: () => undefined,
  },
}

// docs/standards/design-system.md's Storybook rule — every component gets a story with the
// viewport addon at 375/768/1280, same convention ClubForm.stories.tsx/SubscriptionForm
// .stories.tsx already establish.
export const MobileViewport: Story = {
  args: Create.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Create.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Create.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
