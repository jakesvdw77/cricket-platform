import type { Meta, StoryObj } from '@storybook/react-vite'
import { AddCard } from './AddCard'

const meta: Meta<typeof AddCard> = {
  title: 'Components/AddCard',
  component: AddCard,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
}
export default meta

type Story = StoryObj<typeof AddCard>

export const Default: Story = { args: { label: 'Create New League', to: '/new' } }

export const Disabled: Story = { args: { label: 'Create New League', disabled: true } }
