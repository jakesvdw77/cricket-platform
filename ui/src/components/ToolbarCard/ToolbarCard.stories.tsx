import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { useState } from 'react'
import { ToolbarCard } from './ToolbarCard'
import { ToolbarSortButton } from './ToolbarSortButton'
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
