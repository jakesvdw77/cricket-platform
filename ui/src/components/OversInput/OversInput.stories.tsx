import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { OversInput } from './OversInput'

const meta: Meta<typeof OversInput> = {
  title: 'Components/OversInput',
  component: OversInput,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof OversInput>

function Controlled({ initial }: { initial: number | null }) {
  const [balls, setBalls] = useState<number | null>(initial)
  return (
    <div style={{ maxWidth: 160 }}>
      <OversInput label="Overs" value={balls} onChange={setBalls} helperText="36.4 means 36 overs and 4 balls" />
    </div>
  )
}

export const Empty: Story = { render: () => <Controlled initial={null} /> }
export const Filled: Story = { render: () => <Controlled initial={220} /> }
