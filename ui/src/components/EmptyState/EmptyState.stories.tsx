import type { Meta, StoryObj } from '@storybook/react-vite'
import { BrandIcon } from '../BrandIcon'
import { Button } from '../Button'
import { EmptyState } from './EmptyState'
import { EmptyStateLink } from './EmptyStateLink'

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: { title: 'No matches scheduled yet' },
}

export const WithDescription: Story = {
  args: {
    title: 'No matches scheduled yet',
    description: 'Fixtures you add will show up here.',
  },
}

export const WithAction: Story = {
  args: {
    title: 'No matches scheduled yet',
    description: 'Fixtures you add will show up here.',
    action: <Button size="sm">Add match</Button>,
  },
}

export const WithIcon: Story = {
  args: {
    icon: <BrandIcon name="nav/result-scorecard" size={48} padding={4} />,
    title: 'No results yet',
    description: 'Captured results will show up here.',
  },
}

// docs/specs/136: the standard empty-state action is an underlined text link worded "Create New <Record>".
export const WithLink: Story = {
  args: {
    title: 'No seasons yet',
    description: "Create your club's first season to get started.",
    action: <EmptyStateLink onClick={() => undefined}>Create New Season</EmptyStateLink>,
  },
}
