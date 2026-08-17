import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShellHeader } from './ShellHeader'

const meta: Meta<typeof ShellHeader> = {
  title: 'Components/ShellHeader',
  component: ShellHeader,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof ShellHeader>

const args = {
  brand: 'Cricket Legend Platform',
  user: { name: 'Ada Lovelace', email: 'ada@example.com' },
  onLogout: () => {},
  profileTo: '/admin/profile',
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
