import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageCounters } from './PageCounters'

const meta: Meta<typeof PageCounters> = {
  title: 'Components/PageCounters',
  component: PageCounters,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PageCounters>

const base = [
  { id: 'open', value: 4, label: 'Open polls' },
  { id: 'responded', value: '18 / 24', label: 'Players responded' },
  { id: 'awaited', value: 6, label: 'Answers awaited' },
  { id: 'closing', value: 2, label: 'Close in 48 hours' },
]

export const Default: Story = { args: { items: base } }

export const Warning: Story = {
  args: {
    items: base.map((item) => (item.id === 'awaited' || item.id === 'closing' ? { ...item, tone: 'warning' as const } : item)),
  },
}

export const Active: Story = {
  args: { items: base.map((item) => (item.id === 'open' ? { ...item, active: true } : item)) },
}

export const Selectable: Story = {
  args: {
    items: base.map((item, index) => ({
      ...item,
      active: index === 0,
      hint: 'Tap to filter',
      onSelect: () => undefined,
    })),
  },
}

export const Loading: Story = { args: { items: [], loading: true } }
