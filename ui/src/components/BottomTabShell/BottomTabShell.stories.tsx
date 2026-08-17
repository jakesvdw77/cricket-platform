import type { Meta, StoryObj } from '@storybook/react-vite'
import { Typography } from '@mui/material'
import { Card } from '../Card'
import { BottomTabShell } from './BottomTabShell'

const meta: Meta<typeof BottomTabShell> = {
  title: 'Components/BottomTabShell',
  component: BottomTabShell,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof BottomTabShell>

const navItems = [
  { label: 'Fixtures', to: '/player' },
  { label: 'Results', to: '/player/results' },
  { label: 'Availability', to: '/player/availability' },
  { label: 'Profile', to: '/player/profile' },
]

const args = {
  brand: 'Cricket Legend Platform',
  navItems,
  user: { name: 'Alex Player' },
  onLogout: () => {},
  profileTo: '/player/profile',
  children: (
    <Card title="Next match">
      <Typography variant="body2" color="text.secondary">
        Saturday, 14:00 — Home ground
      </Typography>
    </Card>
  ),
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
