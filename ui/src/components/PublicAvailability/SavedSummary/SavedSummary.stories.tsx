import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SavedSummary } from './SavedSummary'

const meta: Meta<typeof SavedSummary> = {
  title: 'Components/PublicAvailability/SavedSummary',
  component: SavedSummary,
  parameters: { layout: 'padded' },
  args: { firstName: 'Liam', onChangeAnswer: fn(), onSomeoneElse: fn() },
}
export default meta

type Story = StoryObj<typeof SavedSummary>

export const Group: Story = {
  args: {
    entries: [
      { label: 'Thu 15 Oct · Morning', status: 'AVAILABLE' },
      { label: 'Thu 15 Oct · Afternoon', status: 'UNSURE' },
    ],
  },
}

export const Squad: Story = { args: { entries: [{ label: 'Your answer', status: 'UNAVAILABLE' }] } }
