import type { Meta, StoryObj } from '@storybook/react-vite'
import { CompactSwitch } from './CompactSwitch'

const meta: Meta<typeof CompactSwitch> = {
  title: 'Components/CompactSwitch',
  component: CompactSwitch,
  args: { label: 'Show closed polls', checked: false, onChange: () => undefined },
}
export default meta

type Story = StoryObj<typeof CompactSwitch>

export const Off: Story = {}
export const On: Story = { args: { checked: true } }
export const Disabled: Story = { args: { checked: true, disabled: true } }
export const LongLabel: Story = { args: { label: "Hide players who haven't answered", noWrap: false } }
