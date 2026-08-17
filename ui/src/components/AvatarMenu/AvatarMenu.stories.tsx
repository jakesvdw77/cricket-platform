import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvatarMenu } from './AvatarMenu'

const meta: Meta<typeof AvatarMenu> = {
  title: 'Components/AvatarMenu',
  component: AvatarMenu,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof AvatarMenu>

const args = { name: 'Jaco Smith', email: 'jaco@riverside.cc', onLogout: () => {} }

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
