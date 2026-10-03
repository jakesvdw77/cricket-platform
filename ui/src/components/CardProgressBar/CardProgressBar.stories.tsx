import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { CardProgressBar } from './CardProgressBar'

const meta: Meta<typeof CardProgressBar> = {
  title: 'Components/CardProgressBar',
  component: CardProgressBar,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 360 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof CardProgressBar>

export const Partial: Story = {
  args: { value: 5, max: 12, ariaLabel: 'Matches played', valueText: '5 of 12 played' },
}

export const Empty: Story = {
  args: { value: 0, max: 0, ariaLabel: 'Matches played', valueText: 'none scheduled' },
}

export const Complete: Story = {
  args: { value: 11, max: 11, ariaLabel: 'Selection', valueText: '11 of 11 picked' },
}
