import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { LinkRequestsWaitingCard } from './LinkRequestsWaitingCard'

const meta: Meta<typeof LinkRequestsWaitingCard> = {
  title: 'Components/LinkRequestsWaitingCard',
  component: LinkRequestsWaitingCard,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof LinkRequestsWaitingCard>

export const Several: Story = { args: { waiting: 3 } }
export const One: Story = { args: { waiting: 1 } }
export const NoneRendersNothing: Story = { args: { waiting: 0 } }
