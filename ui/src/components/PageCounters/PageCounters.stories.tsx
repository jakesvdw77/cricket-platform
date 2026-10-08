import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
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
  { id: 'awaited', value: 6, label: 'Players still to answer' },
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

const noop = () => undefined

export const Filter: Story = {
  args: {
    items: [
      { ...base[0], active: true, kind: 'reset', hint: 'Show all', onSelect: noop },
      base[1],
      base[2],
      { ...base[3], tone: 'warning', kind: 'filter', hint: 'Tap to filter', onSelect: noop },
    ],
  },
}

export const DrillDown: Story = {
  args: {
    items: [
      base[0],
      { ...base[1], kind: 'drill', hint: 'See who', onSelect: noop },
      { ...base[2], tone: 'warning', kind: 'drill', hint: 'See who', onSelect: noop },
      base[3],
    ],
  },
}

// A selectable counter whose figure is 0 is a plain card (no marker, not a button), unless it is the active filter.
export const Zero: Story = {
  args: {
    items: [
      { ...base[0], active: true, kind: 'reset', onSelect: noop },
      { ...base[1], value: '0 / 24', kind: 'drill', onSelect: noop },
      { ...base[2], value: 0, kind: 'drill', hint: 'See who', onSelect: noop },
      { ...base[3], value: 0, kind: 'filter', hint: 'Tap to filter', onSelect: noop },
    ],
  },
}

// Hovers "Close in 48 hours" so the lift and faint tint are visible without a pointer.
export const Hover: Story = {
  args: Filter.args,
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByTestId('page-counter-closing'))
  },
}

export const Loading: Story = { args: { items: [], loading: true } }

// docs/specs/085: the compact density used by the Availability Polls page.
export const Compact: Story = {
  args: {
    density: 'compact',
    items: [
      { ...base[0], active: true, kind: 'reset', hint: 'Show all', onSelect: noop },
      { ...base[1], kind: 'drill', hint: 'See who', onSelect: noop },
      { ...base[2], tone: 'warning', kind: 'drill', hint: 'See who', onSelect: noop },
      { ...base[3], tone: 'warning', kind: 'filter', hint: 'Tap to filter', onSelect: noop },
    ],
  },
}

export const CompactActive: Story = {
  args: { ...Compact.args, items: (Compact.args?.items ?? []).map((item, index) => ({ ...item, active: index === 3 })) },
}

export const CompactWarning: Story = { args: { density: 'compact', items: Warning.args?.items ?? [] } }

export const CompactLoading: Story = { args: { density: 'compact', items: [], loading: true } }
