import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { ActionsMenu } from './ActionsMenu'

const meta: Meta<typeof ActionsMenu> = {
  title: 'Components/ActionsMenu',
  component: ActionsMenu,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
}
export default meta

type Story = StoryObj<typeof ActionsMenu>

const items = [
  { id: 'duplicate', label: 'Duplicate league', icon: <ContentCopyOutlinedIcon fontSize="small" />, onClick: () => undefined },
  { id: 'share', label: 'Share league...', icon: <ShareOutlinedIcon fontSize="small" />, onClick: () => undefined },
  { id: 'history', label: 'Import history (2)', icon: <HistoryOutlinedIcon fontSize="small" />, to: '/history' },
]

export const Default: Story = { args: { items } }

export const WithDisabledItem: Story = {
  args: { items: [...items, { id: 'blocked', label: 'Delete', disabled: true, reason: 'Nothing can be deleted while matches exist.' }] },
}

export const DisabledTrigger: Story = { args: { items, disabled: true } }

export const Phone: Story = { args: { items }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
