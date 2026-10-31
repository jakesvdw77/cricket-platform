import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { ManageMenu } from './ManageMenu'
import type { ManageMenuGroup } from './ManageMenu'

const meta: Meta<typeof ManageMenu> = {
  title: 'Components/ManageMenu',
  component: ManageMenu,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
}
export default meta

type Story = StoryObj<typeof ManageMenu>

const groups: ManageMenuGroup[] = [
  {
    id: 'league',
    heading: 'League',
    items: [
      { id: 'edit', title: 'Edit League Details', description: 'Name, format, age rules, contacts and links.', icon: <EditOutlinedIcon fontSize="small" />, to: '/edit' },
      { id: 'share', title: 'Share League', description: 'Schedule, results, teams or conditions.', icon: <ShareOutlinedIcon fontSize="small" />, onClick: () => undefined },
    ],
  },
  {
    id: 'schedule',
    heading: 'Schedule',
    items: [
      { id: 'add-match', title: 'Add Match', description: 'Create one fixture for this league and season.', icon: <AddOutlinedIcon fontSize="small" />, to: '/matches/new' },
      { id: 'import', title: 'Import Schedule', description: 'Upload an Excel or CSV file.', icon: <DescriptionOutlinedIcon fontSize="small" />, disabled: true, reason: 'Create a season first' },
    ],
  },
]

export const Default: Story = { args: { label: 'Manage League', groups } }

export const ActiveTabGroupFirst: Story = { args: { label: 'Manage League', groups, openFirstGroupId: 'schedule' } }

export const TabRowWhiteFixedWidth: Story = { args: { label: 'Manage Schedule', groups: [groups[1]], buttonVariant: 'secondary', fixedWidth: true } }

export const Phone: Story = { args: { label: 'Manage League', groups }, parameters: { viewport: { defaultViewport: 'mobile1' } } }

const rowItems = [
  { id: 'open', title: 'Open League', icon: <EditOutlinedIcon fontSize="small" />, to: '/open' },
  { id: 'share', title: 'Share League', icon: <ShareOutlinedIcon fontSize="small" />, onClick: () => undefined },
  { id: 'import', title: 'Import Schedule', icon: <DescriptionOutlinedIcon fontSize="small" />, disabled: true, reason: 'Create a season first' },
]

// A table row's or card's one Actions button (docs/standards/page-anatomy.md section 6).
export const RowKebab: Story = {
  args: { label: 'Actions for TVL Division 1 T20', trigger: 'kebab', dense: true, groups: [{ id: 'actions', heading: 'Actions', items: rowItems }] },
}
