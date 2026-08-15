import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './Input'

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: { label: 'Club name' },
}

export const WithHelperText: Story = {
  args: { label: 'Club name', helperText: "This appears on the club's public schedule." },
}

export const WithError: Story = {
  args: { label: 'Club name', error: true, helperText: 'Club name is required.' },
}

export const Required: Story = {
  args: { label: 'Club name', required: true },
}
