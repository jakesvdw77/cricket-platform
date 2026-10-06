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
