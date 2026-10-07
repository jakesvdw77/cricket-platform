import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PickPlayer } from './PickPlayer'

const meta: Meta<typeof PickPlayer> = {
  title: 'Components/PublicAvailability/PickPlayer',
  component: PickPlayer,
  parameters: { layout: 'padded' },
  args: {
    firstName: 'Liam',
    lastName: 'Carter',
    onPick: fn(),
    candidates: [
      { playerId: 'a', shirtNumber: 7, teamLabel: 'Villagers 1' },
      { playerId: 'b', shirtNumber: 12, teamLabel: 'Villagers 2' },
    ],
  },
}
export default meta

type Story = StoryObj<typeof PickPlayer>

export const Default: Story = {}
export const WithoutShirtNumbers: Story = {
  args: {
    candidates: [
      { playerId: 'a', shirtNumber: null, teamLabel: 'Villagers 1' },
      { playerId: 'b', shirtNumber: null, teamLabel: 'Villagers 2' },
    ],
    onBack: fn(),
  },
}
