import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { BottomTabBar } from './BottomTabBar'
import { MANAGER_NAV, managerTabs } from '../ManagerShell/managerNav'

const meta: Meta<typeof BottomTabBar> = {
  title: 'Components/BottomTabBar',
  component: BottomTabBar,
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile' } },
  args: { tabs: managerTabs(), groups: MANAGER_NAV, onMenuClick: () => {} },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/manage/fixtures/matches']}>
        <Story />
      </MemoryRouter>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof BottomTabBar>

export const Default: Story = {}

export const MenuOpen: Story = { args: { menuOpen: true } }

export const WithPollsBadge: Story = { args: { badges: { polls: 3 } } }
