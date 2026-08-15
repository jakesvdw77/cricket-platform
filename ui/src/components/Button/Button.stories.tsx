import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stack } from '@mui/material'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof Button>

export const Variants: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </Stack>
  ),
}

export const Sizes: Story = {
  render: () => (
    <Stack direction="row" spacing={2} alignItems="center">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
    </Stack>
  ),
}

export const Disabled: Story = {
  args: { children: 'Save', disabled: true },
}
