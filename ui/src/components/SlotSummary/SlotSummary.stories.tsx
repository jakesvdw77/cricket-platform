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

// docs/specs/082: the enlarged legend with three-digit counts, in a narrow card and a wide column.
export const LongCounts: Story = {
  args: { heading: 'Sat 3 Oct · Morning', counts: { available: 128, unsure: 14, unavailable: 240, noResponse: 96 } },
}

export const LongCountsCompactNarrow: Story = {
  args: { heading: 'Sat 3 Oct · Morning', compact: true, counts: { available: 128, unsure: 14, unavailable: 240, noResponse: 96 } },
  decorators: [
    (StoryComponent) => (
      <Box sx={{ width: 280 }}>
        <StoryComponent />
      </Box>
    ),
  ],
}

// docs/specs/082: 'N of M answered' on the heading line (normal width), and wrapped under a long
// heading with long counts in a tight column.
export const AnsweredOnHeadingLine: Story = {
  args: { heading: 'Thu, 15 Oct · Morning', counts: { available: 4, unsure: 0, unavailable: 1, noResponse: 13 } },
}

export const AnsweredWrapsWhenTight: Story = {
  args: {
    heading: 'Thursday, 15 October · Afternoon',
    compact: true,
    counts: { available: 128, unsure: 14, unavailable: 40, noResponse: 58 },
  },
  decorators: [
    (StoryComponent) => (
      <Box sx={{ width: 260 }}>
        <StoryComponent />
      </Box>
    ),
  ],
}

// docs/specs/082: unequal label lengths and large counts - dots, words and counts line up in columns.
export const LegendAlignment: Story = {
  args: { heading: 'Thu, 15 Oct · Morning', counts: { available: 128, unsure: 7, unavailable: 240, noResponse: 1 } },
}

// Under ~300px of card width the legend falls back to one pair per row, still aligned.
export const LegendNarrow: Story = {
  args: { heading: 'Thu, 15 Oct · Morning', compact: true, counts: { available: 128, unsure: 7, unavailable: 240, noResponse: 1 } },
  decorators: [
    (StoryComponent) => (
      <Box sx={{ width: 240 }}>
        <StoryComponent />
      </Box>
    ),
  ],
}
