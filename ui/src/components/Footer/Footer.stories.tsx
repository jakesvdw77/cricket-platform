import type { Meta, StoryObj } from '@storybook/react-vite'
import { Footer } from './Footer'

const meta: Meta<typeof Footer> = {
  title: 'Components/Footer',
  component: Footer,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof Footer>

export const Default: Story = {
  args: {},
}
