import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { AddCard } from './AddCard'

const meta: Meta<typeof AddCard> = {
  title: 'Components/AddCard',
  component: AddCard,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <MemoryRouter><div style={{ maxWidth: 420 }}><Story /></div></MemoryRouter>],
}
export default meta

type Story = StoryObj<typeof AddCard>

export const Default: Story = { args: { label: 'Add League', to: '/new' } }

export const Disabled: Story = { args: { label: 'Add League', disabled: true } }
