import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvatarMenu } from './AvatarMenu'

const meta: Meta<typeof AvatarMenu> = {
  title: 'Components/AvatarMenu',
  component: AvatarMenu,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof AvatarMenu>

export const Default: Story = {
  args: { name: 'Jaco Smith', email: 'jaco@riverside.cc', onLogout: () => {} },
}
