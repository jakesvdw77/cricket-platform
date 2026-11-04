import type { Meta, StoryObj } from '@storybook/react-vite'
import { TeamNameLink } from './TeamNameLink'

const meta: Meta<typeof TeamNameLink> = {
  title: 'Pages/Manage/TeamSelection/TeamNameLink',
  component: TeamNameLink,
  args: { sectionId: 'section-1', teamId: 'team-1', name: 'Irene Villagers 1' },
}
export default meta

type Story = StoryObj<typeof TeamNameLink>

// docs/specs/137 (page-anatomy section 5): a team's name is a link to the team page, carrying returnTo.
export const Default: Story = {}
