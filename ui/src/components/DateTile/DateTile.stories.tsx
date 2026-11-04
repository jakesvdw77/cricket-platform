import type { Meta, StoryObj } from '@storybook/react-vite'
import { DateTile } from './DateTile'

const meta: Meta<typeof DateTile> = {
  title: 'Components/DateTile',
  component: DateTile,
  args: { date: '2030-06-17T10:00:00' },
}
export default meta

type Story = StoryObj<typeof DateTile>

export const Default: Story = {}
