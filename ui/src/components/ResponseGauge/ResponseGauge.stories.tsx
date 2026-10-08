import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { ResponseGauge } from './ResponseGauge'

const meta: Meta<typeof ResponseGauge> = {
  title: 'Components/ResponseGauge',
  component: ResponseGauge,
  parameters: { layout: 'padded' },
  decorators: [
    (StoryComponent) => (
      <Box sx={{ maxWidth: 420 }}>
        <StoryComponent />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ResponseGauge>

export const PollMode: Story = { args: { mode: 'poll', coverage: { all: 12, some: 3, none: 3 } } }

export const StatusMode: Story = { args: { mode: 'status', counts: { available: 8, unsure: 2, unavailable: 3, noResponse: 5 } } }

export const Empty: Story = { args: { mode: 'status', counts: { available: 0, unsure: 0, unavailable: 0, noResponse: 0 } } }

export const ThinSlotBar: Story = {
  args: { mode: 'status', variant: 'thin', counts: { available: 13, unsure: 0, unavailable: 2, noResponse: 3 } },
}
