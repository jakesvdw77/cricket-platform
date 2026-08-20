import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersonPicker } from './PersonPicker'

const meta: Meta<typeof PersonPicker> = {
  title: 'Components/PersonPicker',
  component: PersonPicker,
  parameters: { layout: 'padded' },
  // PersonPicker is backed by React Query (searches GET /platform/persons on focus) — wrap in a
  // QueryClientProvider, same pattern as ClubPicker.stories.tsx, and decorate with the same
  // field-grid RecordFormScreen provides in the real app.
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

type Story = StoryObj<typeof PersonPicker>

export const Search: Story = {
  args: {
    value: null,
    onChange: () => undefined,
  },
}

export const Create: Story = {
  args: {
    value: { mode: 'new', firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@example.com', phone: '021 555 0100' },
    onChange: () => undefined,
  },
}

export const Selected: Story = {
  args: {
    value: {
      mode: 'existing',
      id: 'person-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phone: '021 555 0100',
    },
    onChange: () => undefined,
  },
}

// docs/standards/design-system.md's Storybook rule — every component gets a story with the
// viewport addon at 375/768/1280, same convention ClubPicker.stories.tsx already establishes.
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
