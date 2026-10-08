import type { Meta, StoryObj } from '@storybook/react-vite'
import { Typography } from '@mui/material'
import { SidePanel } from './SidePanel'

const meta: Meta<typeof SidePanel> = {
  title: 'Components/SidePanel',
  component: SidePanel,
  args: {
    open: true,
    onClose: () => undefined,
    title: 'Polls',
    closeLabel: 'Close polls list',
    children: (isPhone: boolean) => <Typography>{isPhone ? 'Bottom sheet content' : 'Right drawer content'}</Typography>,
  },
}
export default meta

type Story = StoryObj<typeof SidePanel>

export const Open: Story = {}
