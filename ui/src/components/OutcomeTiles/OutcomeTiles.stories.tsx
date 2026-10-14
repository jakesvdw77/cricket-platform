import type { Meta, StoryObj } from '@storybook/react-vite'
import { OutcomeTiles } from './OutcomeTiles'

const meta: Meta<typeof OutcomeTiles> = {
  title: 'Components/OutcomeTiles',
  component: OutcomeTiles,
  parameters: { layout: 'padded' },
  args: { onChange: () => {} },
}
export default meta

type Story = StoryObj<typeof OutcomeTiles>

export const NothingChosen: Story = { args: { value: null } }
export const Won: Story = { args: { value: 'WON' } }
