import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined'
import { useState } from 'react'
import { ToolbarCard } from './ToolbarCard'
import { ToolbarSortButton } from './ToolbarSortButton'
import { ToolbarMultiToggle } from './ToolbarMultiToggle'
import { ToolbarToggle } from './ToolbarToggle'
import { ToolbarToggleChip } from './ToolbarToggleChip'
import { ListViewToggle } from '../ListViewToggle'

const meta: Meta<typeof ToolbarCard> = {
  title: 'Components/ToolbarCard',
  component: ToolbarCard,
  args: { children: <Box sx={{ p: 1 }}>Filters and search go here</Box> },
}
export default meta
type Story = StoryObj<typeof ToolbarCard>

export const Standalone: Story = {}

export const Fused: Story = {
  args: { fused: true },
  render: (args) => (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'clip' }}>
      <ToolbarCard {...args} />
      <Box sx={{ p: 1.5 }}>Table header and rows</Box>
    </Box>
  ),
}

function ControlsRowDemo() {
    const [sort, setSort] = useState('asc')
    const [inactive, setInactive] = useState(false)
    const [view, setView] = useState<'cards' | 'list'>('cards')
    return (
      <ToolbarCard>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          <ToolbarToggleChip pressed={inactive} onChange={setInactive} label="Show inactive" />
          <ToolbarSortButton value={sort} onChange={setSort} options={[{ value: 'asc', label: 'Name, A to Z' }, { value: 'desc', label: 'Name, Z to A' }]} />
          <ListViewToggle value={view} onChange={setView} variant="toolbar" />
        </Box>
      </ToolbarCard>
    )
}

export const ControlsRow: Story = { render: () => <ControlsRowDemo /> }

// A disabled chip stays as it is and cannot be pressed.
export const DisabledChip: Story = {
  render: () => (
    <ToolbarCard>
      <ToolbarToggleChip pressed disabled onChange={() => undefined} label="Show Closed Polls" />
    </ToolbarCard>
  ),
}

// docs/specs/136: a set of on/off kinds as one segmented toggle (small icon plus label); the last one left on is disabled.
export const MultiToggle: Story = {
  render: () => (
    <ToolbarCard>
      <ToolbarMultiToggle
        ariaLabel="Poll types"
        selected={['group']}
        onChange={() => undefined}
        options={[
          { value: 'group', label: 'Group Polls', icon: <ViewListOutlinedIcon sx={{ fontSize: 16 }} /> },
          { value: 'squad', label: 'Squad Polls', icon: <GroupsOutlinedIcon sx={{ fontSize: 16 }} /> },
        ]}
      />
    </ToolbarCard>
  ),
}

// The same toggle drawn by placement: a chip in the toolbar row, a switch in the phone's Filters sheet.
export const TogglePlacements: Story = {
  render: () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ToolbarCard><ToolbarToggle placement="row" checked onChange={() => undefined} label="View Entire Season" /></ToolbarCard>
      <ToolbarToggle placement="sheet" checked onChange={() => undefined} label="View Entire Season" />
    </Box>
  ),
}
