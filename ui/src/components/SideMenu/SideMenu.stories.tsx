import type { Meta, StoryObj } from '@storybook/react-vite'
import { PinRoute } from '../../test/PinRoute'
import { SideMenu } from './SideMenu'
import { MANAGER_NAV } from '../ManagerShell/managerNav'

// .storybook/preview.tsx already provides a router; PinRoute moves it to the route under test.
const meta: Meta<typeof SideMenu> = {
  title: 'Components/SideMenu',
  component: SideMenu,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PinRoute to="/manage/fixtures/matches/123/edit">
        <Story />
      </PinRoute>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof SideMenu>

export const Full: Story = { args: { groups: MANAGER_NAV } }

export const CollapsedRail: Story = { args: { groups: MANAGER_NAV, collapsed: true } }

export const WithBadges: Story = { args: { groups: MANAGER_NAV, badges: { polls: 3 } } }

export const CollapsedWithBadges: Story = { args: { groups: MANAGER_NAV, collapsed: true, badges: { polls: 3 } } }

// docs/specs/139: the experiment, old and new side by side. Classic is the 120 look (cream-ringed tile, gold tint); Quiet puts the icons
// on the dark green with a faint ghost tile; QuietBare has no ghost tile at all.
export const Classic: Story = { args: { groups: MANAGER_NAV, look: 'classic' } }

export const Quiet: Story = { args: { groups: MANAGER_NAV, look: 'quiet' } }

export const QuietBare: Story = { args: { groups: MANAGER_NAV, look: 'quiet', ghost: false } }

export const SideBySide: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <SideMenu groups={MANAGER_NAV} look="classic" aria-label="Classic" />
      <SideMenu groups={MANAGER_NAV} look="quiet" aria-label="Quiet" />
      <SideMenu groups={MANAGER_NAV} look="quiet" ghost={false} aria-label="Quiet bare" />
    </div>
  ),
}
