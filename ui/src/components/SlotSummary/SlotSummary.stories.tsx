import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { SlotSummary } from './SlotSummary'

const meta: Meta<typeof SlotSummary> = {
  title: 'Components/SlotSummary',
  component: SlotSummary,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof SlotSummary>

export const Default: Story = {
  args: {
    heading: 'Sat 3 Oct · Morning',
    counts: { available: 8, unsure: 2, unavailable: 3, noResponse: 5 },
  },
}

export const Compact: Story = {
  args: {
    heading: 'Sat 3 Oct · Afternoon',
    compact: true,
    counts: { available: 4, unsure: 1, unavailable: 0, noResponse: 7 },
  },
}

export const NoOneEligible: Story = {
  args: { heading: 'Sun 4 Oct · Morning', counts: { available: 0, unsure: 0, unavailable: 0, noResponse: 0 } },
}

// The same compact summary inside a 375px-wide column, as it sits in a poll card.
export const NarrowCard: Story = {
  args: Compact.args,
  decorators: [
    (StoryComponent) => (
      <Box sx={{ width: 280 }}>
        <StoryComponent />
      </Box>
    ),
  ],
}
