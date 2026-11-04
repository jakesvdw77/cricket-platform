import type { Meta, StoryObj } from '@storybook/react-vite'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { ChoiceTile } from './ChoiceTile'

const meta: Meta<typeof ChoiceTile> = {
  title: 'Components/ChoiceTile',
  component: ChoiceTile,
  args: {
    icon: <GroupsOutlinedIcon color="primary" />,
    label: 'Squad Poll',
    description: "Ask one team's squad about one or more of its matches.",
    onClick: () => undefined,
  },
}
export default meta

type Story = StoryObj<typeof ChoiceTile>

export const Default: Story = {}

export const Disabled: Story = { args: { disabled: true } }

export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } }
