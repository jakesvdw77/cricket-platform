import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { RememberedPlayers } from './RememberedPlayers'

const meta: Meta<typeof RememberedPlayers> = {
  title: 'Components/PublicAvailability/RememberedPlayers',
  component: RememberedPlayers,
  parameters: { layout: 'padded' },
  args: {
    players: [
      { firstName: 'Liam', lastName: 'Carter', answeredAt: '2026-10-13T16:40:00Z' },
      { firstName: 'Emma', lastName: 'Carter', answeredAt: null },
    ],
    onSelect: fn(),
    onRemove: fn(),
    onForgetAll: fn(),
    onSomeoneElse: fn(),
  },
}
export default meta

type Story = StoryObj<typeof RememberedPlayers>

export const Default: Story = {}
export const OnePlayer: Story = {
  args: { players: [{ firstName: 'Liam', lastName: 'Carter', answeredAt: '2026-10-13T16:40:00Z' }] },
}
