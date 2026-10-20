import type { Meta, StoryObj } from '@storybook/react-vite'
import { FormStrip } from './FormStrip'

const meta: Meta<typeof FormStrip> = {
  title: 'Components/FormStrip',
  component: FormStrip,
  args: {
    title: 'Batting, last 5 innings',
    items: [
      { key: '1', label: '34' },
      { key: '2', label: '0', tone: 'muted' },
      { key: '3', label: '56*', tone: 'positive' },
      { key: '4', label: '12' },
      { key: '5', label: '8' },
    ],
  },
}
export default meta

type Story = StoryObj<typeof FormStrip>

export const Batting: Story = {}

export const Bowling: Story = {
  args: {
    title: 'Bowling, last 5 spells',
    items: [
      { key: '1', label: '2/21', tone: 'positive' },
      { key: '2', label: '0/18' },
      { key: '3', label: '3/30', tone: 'positive' },
    ],
  },
}

export const Comfortable: Story = { args: { size: 'comfortable' } }
