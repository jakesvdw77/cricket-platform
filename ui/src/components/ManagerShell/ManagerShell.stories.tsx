import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { Typography } from '@mui/material'
import { ManagerShell } from './ManagerShell'

const meta: Meta<typeof ManagerShell> = {
  title: 'Components/ManagerShell',
  component: ManagerShell,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/manage/players']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    brand: 'Riverside Cricket Club',
    user: { name: 'Sam Manager', email: 'sam@riverside.example.com' },
    onLogout: () => {},
    profileTo: '/manage/profile',
    homeTo: '/manage',
    logoUrl: null,
    children: <Typography variant="h6">Page content</Typography>,
  },
}
export default meta

type Story = StoryObj<typeof ManagerShell>

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
export const TabletRail: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }
export const WithPollsBadge: Story = { args: { badges: { polls: 3 } }, parameters: { viewport: { defaultViewport: 'desktop' } } }
