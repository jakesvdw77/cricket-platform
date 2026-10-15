import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { ReconcileStrip } from './ReconcileStrip'

const meta: Meta<typeof ReconcileStrip> = {
  title: 'Components/ReconcileStrip',
  component: ReconcileStrip,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 520 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ReconcileStrip>

export const TotalMatches: Story = {
  args: { tone: 'ok', title: 'Total 148 = 135 off the bat + 13 extras', status: 'matches the innings total' },
}

export const TotalMismatch: Story = {
  args: { tone: 'warning', title: 'Total 151 = 138 off the bat + 13 extras', status: '3 more than the innings total' },
}

export const WicketsMeter: Story = {
  args: {
    tone: 'ok',
    title: 'Out 4 of 6',
    progress: { value: 4, max: 6, ariaLabel: 'Batters out', valueText: '4 of 6 out' },
  },
}

export const WicketsOver: Story = {
  args: {
    tone: 'warning',
    title: 'Out 7 of 6',
    status: '1 more than the result says',
    progress: { value: 7, max: 6, ariaLabel: 'Batters out', valueText: '7 of 6 out' },
  },
}
