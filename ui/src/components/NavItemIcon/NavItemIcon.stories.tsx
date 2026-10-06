import type { Meta, StoryObj } from '@storybook/react-vite'
import { NavItemIcon } from './NavItemIcon'

const meta: Meta<typeof NavItemIcon> = {
  title: 'Components/NavItemIcon',
  component: NavItemIcon,
}
export default meta

type Story = StoryObj<typeof NavItemIcon>

export const Brand: Story = { args: { name: 'nav/teams', size: 32 } }
export const HomeGlyph: Story = { args: { name: 'home', size: 32 } }
export const MenuGlyph: Story = { args: { name: 'menu', size: 32 } }
