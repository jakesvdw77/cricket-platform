import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProgressMeter } from './ProgressMeter'

const meta: Meta<typeof ProgressMeter> = {
  title: 'Components/ProgressMeter',
  component: ProgressMeter,
  args: { value: 3, max: 4, ariaLabel: 'Matches played' },
  decorators: [(Story) => <div style={{ width: 220 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof ProgressMeter>

export const Default: Story = {}
export const CustomLabel: Story = { args: { label: '3 of 4 played' } }
export const Complete: Story = { args: { value: 4 } }
export const Empty: Story = { args: { value: 0, max: 0, emptyLabel: 'No matches scheduled' } }
