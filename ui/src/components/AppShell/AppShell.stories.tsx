import type { Meta, StoryObj } from '@storybook/react-vite'
import { Typography } from '@mui/material'
import { AppShell } from './AppShell'

const meta: Meta<typeof AppShell> = {
  title: 'Components/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof AppShell>

const navItems = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Club Onboarding', to: '/admin/onboarding' },
  { label: 'Whitelisting', to: '/admin/whitelisting' },
  { label: 'Subscriptions', to: '/admin/billing' },
  { label: 'Leagues', to: '/admin/leagues' },
  { label: 'Configuration', to: '/admin/configuration' },
]

const args = {
  brand: 'Cricket Legend Platform',
  navItems,
  user: { name: 'Ada Lovelace', email: 'ada@example.com' },
  onLogout: () => {},
  profileTo: '/admin/profile',
  children: <Typography variant="body2">Page content</Typography>,
}

export const Mobile: Story = {
  args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const Tablet: Story = {
  args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const Desktop: Story = {
  args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
