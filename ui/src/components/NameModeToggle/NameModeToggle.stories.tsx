import type { Meta, StoryObj } from '@storybook/react-vite'
import { NameModeToggle } from './NameModeToggle'

const meta: Meta<typeof NameModeToggle> = {
  title: 'Components/NameModeToggle',
  component: NameModeToggle,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof NameModeToggle>

export const Default: Story = {}
