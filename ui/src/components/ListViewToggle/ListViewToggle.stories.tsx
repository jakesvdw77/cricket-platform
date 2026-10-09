import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ListViewToggle } from './ListViewToggle'
import type { ListView } from '../../hooks/useListViewPreference'

const meta: Meta<typeof ListViewToggle> = {
  title: 'Components/ListViewToggle',
  component: ListViewToggle,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ListViewToggle>

function Demo({ initial, fullWidth }: { initial: ListView; fullWidth?: boolean }) {
  const [view, setView] = useState<ListView>(initial)
  return <ListViewToggle value={view} onChange={setView} fullWidth={fullWidth} />
}

// docs/specs/088: the content-line switch, Cards selected.
export const Cards: Story = { render: () => <Demo initial="cards" /> }

export const List: Story = { render: () => <Demo initial="list" /> }

// The phone Filters sheet: two equal parts across the full width, 44 px tall.
export const FullWidthInTheSheet: Story = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Demo initial="list" fullWidth />
    </div>
  ),
}
