import type { Meta, StoryObj } from '@storybook/react-vite'
import { SidePicker } from './SidePicker'

const meta: Meta<typeof SidePicker> = {
  title: 'Components/SidePicker',
  component: SidePicker,
  parameters: { layout: 'padded' },
  args: {
    label: 'Who won?',
    onChange: () => {},
    options: [
      { side: 'HOME', name: 'Irene Villagers 1', initials: 'IV' },
      { side: 'AWAY', name: 'Pretoria Wanderers', initials: 'PW' },
    ],
  },
}
export default meta

type Story = StoryObj<typeof SidePicker>

export const NoneChosen: Story = { args: { value: null } }
export const HomeChosen: Story = { args: { value: 'HOME' } }
