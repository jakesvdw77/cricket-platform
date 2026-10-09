import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ToggleButton } from '@mui/material'
import { CompactToggleGroup } from './CompactToggleGroup'

const meta: Meta<typeof CompactToggleGroup> = {
  title: 'Components/CompactToggleGroup',
  component: CompactToggleGroup,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof CompactToggleGroup>

function Demo({ fullWidth, fullWidthOnPhone }: { fullWidth?: boolean; fullWidthOnPhone?: boolean }) {
  const [value, setValue] = useState('team')
  return (
    <div style={{ maxWidth: 420 }}>
      <CompactToggleGroup value={value} onChange={setValue} ariaLabel="Side" fullWidth={fullWidth} fullWidthOnPhone={fullWidthOnPhone}>
        <ToggleButton value="team">My team</ToggleButton>
        <ToggleButton value="league">League team</ToggleButton>
        <ToggleButton value="other">Other</ToggleButton>
      </CompactToggleGroup>
    </div>
  )
}

// docs/specs/089: the side selector of the match form on a desktop.
export const Compact: Story = { render: () => <Demo /> }

// The phone Filters sheet: equal parts, 44 px.
export const FullWidth: Story = { render: () => <Demo fullWidth /> }

// A form on a phone: full width, 40 px.
export const FullWidthOnPhone: Story = { render: () => <Demo fullWidthOnPhone /> }
