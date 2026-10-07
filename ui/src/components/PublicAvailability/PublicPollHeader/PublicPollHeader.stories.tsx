import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicPollHeader } from './PublicPollHeader'

const meta: Meta<typeof PublicPollHeader> = {
  title: 'Components/PublicAvailability/PublicPollHeader',
  component: PublicPollHeader,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PublicPollHeader>

export const OpenWithCloseTime: Story = {
  args: {
    open: true,
    title: 'Over 40 fixtures',
    subtitle: 'Thursday 15 October · 2 matches',
    scheduledCloseAt: '2030-10-14T07:15:00Z',
  },
}

export const Closed: Story = {
  args: { open: false, title: 'Villagers 1 v POHBS', subtitle: 'Thu 15 Oct, 07:15', details: ['Premier League'] },
}
