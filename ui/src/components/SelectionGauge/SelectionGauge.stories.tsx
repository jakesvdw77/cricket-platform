import type { Meta, StoryObj } from '@storybook/react-vite'
import { SelectionGauge } from './SelectionGauge'

const meta: Meta<typeof SelectionGauge> = {
  title: 'Components/SelectionGauge',
  component: SelectionGauge,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
  args: { ariaLabel: '1st XI selection', size: 12 },
}
export default meta

type Story = StoryObj<typeof SelectionGauge>

export const PartlyPicked: Story = { args: { picked: 10 } }

export const Empty: Story = { args: { picked: 0 } }

export const Complete: Story = { args: { picked: 12 } }

export const CompactPartlyPicked: Story = { args: { picked: 11, size: 12, compact: true } }

export const CompactComplete: Story = { args: { picked: 12, size: 12, compact: true } }
