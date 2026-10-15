import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ExtrasFields } from './ExtrasFields'
import type { ExtrasBreakdown } from '../../utils/battingTotals'

const meta: Meta<typeof ExtrasFields> = {
  title: 'Components/ExtrasFields',
  component: ExtrasFields,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ExtrasFields>

function Demo({ initial }: { initial: ExtrasBreakdown }) {
  const [value, setValue] = useState(initial)
  return <ExtrasFields value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} owner="Our extras" />
}

export const Filled: Story = { render: () => <Demo initial={{ wides: 6, noBalls: 2, byes: 4, legByes: 2, penaltyRuns: 0 }} /> }
export const Empty: Story = { render: () => <Demo initial={{}} /> }
