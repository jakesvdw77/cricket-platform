import type { Meta, StoryObj } from '@storybook/react-vite'
import { LinkButton } from './LinkButton'

const meta: Meta<typeof LinkButton> = {
  title: 'Components/LinkButton',
  component: LinkButton,
  args: { onClick: () => undefined },
}
export default meta

type Story = StoryObj<typeof LinkButton>

export const Default: Story = {}

export const Disabled: Story = { args: { disabled: true } }
