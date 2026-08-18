import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { RecordCard } from './RecordCard'

const meta: Meta<typeof RecordCard> = {
  title: 'Components/RecordCard',
  component: RecordCard,
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

type Story = StoryObj<typeof RecordCard>

export const Active: Story = {
  args: {
    title: 'Club Standard',
    badge: { label: 'Active', tone: 'positive' },
    description: 'Everything a growing club needs to run sections, teams, and fixtures.',
    fields: [
      { label: 'Price', value: 'USD 49.99/month' },
      { label: 'Code', value: 'CLUB_STANDARD' },
    ],
    chips: ['5 sections', '10 teams', '200 players'],
    editLabel: 'Edit',
    onEdit: () => undefined,
  },
}

export const Draft: Story = {
  args: {
    title: 'Club Pro',
    badge: { label: 'Draft', tone: 'neutral' },
    description: 'A higher tier still being defined.',
    fields: [
      { label: 'Price', value: 'USD 99.99/month' },
      { label: 'Code', value: 'CLUB_PRO' },
    ],
    chips: ['Unlimited sections', 'Unlimited teams', 'Unlimited players'],
    editLabel: 'Edit',
    onEdit: () => undefined,
  },
}

export const RetiredWithLink: Story = {
  args: {
    title: 'League Operator',
    badge: { label: 'Retired', tone: 'neutral' },
    description: 'No longer offered to new subscribers.',
    fields: [{ label: 'Price', value: 'Free' }, { label: 'Code', value: 'LEAGUE_OPERATOR' }],
    editLabel: 'Edit',
    editTo: '/admin/configuration/products/p-1/edit',
  },
}

export const MinimalSlots: Story = {
  args: {
    title: 'Club Free',
    editLabel: 'Edit',
    onEdit: () => undefined,
  },
}
