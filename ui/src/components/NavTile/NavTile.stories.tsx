import type { Meta, StoryObj } from '@storybook/react-vite'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import { NavTile } from './NavTile'

// No local MemoryRouter decorator here — .storybook/preview.tsx already wraps every story in one
// globally (see RecordCard.stories.tsx's own note on this).
const meta: Meta<typeof NavTile> = {
  title: 'Components/NavTile',
  component: NavTile,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof NavTile>

export const Default: Story = {
  args: {
    title: 'Teams',
    description: 'Register teams',
    icon: <GroupsOutlinedIcon />,
    to: '/manage/teams',
  },
}

export const ClubStructure: Story = {
  args: {
    title: 'Club Structure',
    description: "Define your club's own section tree",
    icon: <AccountTreeOutlinedIcon />,
    to: '/manage/sections',
  },
}
