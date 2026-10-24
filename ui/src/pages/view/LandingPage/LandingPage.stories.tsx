import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from './LandingPage'
import FindYourClubLogin from './FindYourClubLogin'

// The public landing page (docs/specs/004-landing-page.md). Check it at the 375, 768 and 1280 viewports.
const meta: Meta<typeof LandingPage> = {
  title: 'Pages/LandingPage',
  component: LandingPage,
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
type Story = StoryObj<typeof LandingPage>

export const Default: Story = {}

export const Mobile: Story = { globals: { viewport: { value: 'mobile', isRotated: false } } }

// The Log in dialog: open it from the header. The club finder is the same component inside a dark panel.
export const LoginDialogContent: Story = {
  render: () => (
    <MemoryRouter>
      <Box sx={{ bgcolor: 'chrome.header', p: 3, maxWidth: 420 }}>
        <FindYourClubLogin />
      </Box>
    </MemoryRouter>
  ),
}
