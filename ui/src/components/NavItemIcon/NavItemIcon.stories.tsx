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
export const PlayerAvailabilityGlyph: Story = { args: { name: 'player-availability', size: 32 } }
export const TeamAvailabilityGlyph: Story = { args: { name: 'team-availability', size: 32 } }
