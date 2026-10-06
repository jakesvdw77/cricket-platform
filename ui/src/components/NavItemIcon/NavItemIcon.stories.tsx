import type { Meta, StoryObj } from '@storybook/react-vite'
import { NavItemIcon } from './NavItemIcon'

const meta: Meta<typeof NavItemIcon> = {
  title: 'Components/NavItemIcon',
  component: NavItemIcon,
}
export default meta

type Story = StoryObj<typeof NavItemIcon>

export const Brand: Story = { args: { name: 'nav/teams', size: 32 } }
export const Overview: Story = { args: { name: 'nav/overview-home', size: 32 } }
export const MenuGlyph: Story = { args: { name: 'menu', size: 32 } }
export const PlayerAvailability: Story = { args: { name: 'nav/availability-player', size: 32 } }
export const TeamAvailability: Story = { args: { name: 'nav/availability-team', size: 32 } }
