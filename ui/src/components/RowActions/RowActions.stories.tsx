import type { Meta, StoryObj } from '@storybook/react-vite'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { RowActions } from './RowActions'
import type { RowAction } from './RowActions'

// No local router: .storybook/preview.tsx already wraps every story in a MemoryRouter.
const meta: Meta<typeof RowActions> = {
  title: 'Components/RowActions',
  component: RowActions,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof RowActions>

const actions: RowAction[] = [
  { id: 'view', label: 'View', icon: <VisibilityOutlinedIcon fontSize="small" />, to: '/view' },
  { id: 'edit', label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => undefined },
]

const unaffiliate: RowAction = {
  id: 'unaffiliate',
  label: 'Unaffiliate',
  icon: <LinkOffIcon fontSize="small" />,
  destructive: true,
  onClick: () => undefined,
}

export const Desktop: Story = {
  args: { label: 'Irene Villagers 1', actions },
  parameters: { viewport: { defaultViewport: 'desktop' } },
}

// Below sm the icons collapse into one three-dot menu button.
export const Phone: Story = {
  args: { label: 'Irene Villagers 1', actions: [...actions, unaffiliate] },
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const Destructive: Story = {
  args: { label: 'Irene Villagers 1', actions: [...actions, unaffiliate] },
}

export const Disabled: Story = {
  args: { label: 'Irene Villagers 1', actions: [actions[0], { ...actions[1], disabled: true }, unaffiliate] },
}
