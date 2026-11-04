import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatchWeatherDialog } from './MatchWeatherDialog'

const meta: Meta<typeof MatchWeatherDialog> = {
  title: 'Components/MatchWeatherDialog',
  component: MatchWeatherDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onClose: () => undefined,
    title: 'Irene Villagers 1 v Brits',
    subtitle: 'Thu 5 Nov, 09:15 · Hofmeyer Park',
    summary: { label: 'Mostly sunny', icon: 'sunny', tempMin: 14, tempMax: 27, rainChance: 20, text: 'Mostly sunny, 14 to 27 degrees, 20% rain', short: '14 to 27 degrees, 20% rain', lines: ['Dry through the morning.', 'A light breeze from the west.'] },
  },
}
export default meta

type Story = StoryObj<typeof MatchWeatherDialog>

export const Default: Story = {}
