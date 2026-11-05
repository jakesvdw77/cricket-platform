import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { TeamActionsMenu } from './TeamActionsMenu'

const meta: Meta<typeof TeamActionsMenu> = {
  title: 'Components/TeamActionsMenu',
  component: TeamActionsMenu,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: {
    teamName: '1st XI',
    openTo: '/manage/sections/section-1/teams/team-1',
    editTo: '/manage/sections/section-1/teams/team-1/edit',
    statsTo: '/manage/teams/team-1/stats',
  },
}
export default meta
type Story = StoryObj<typeof TeamActionsMenu>

export const Kebab: Story = {}
export const ManageTeamButton: Story = { args: { trigger: 'button', openTo: undefined } }
