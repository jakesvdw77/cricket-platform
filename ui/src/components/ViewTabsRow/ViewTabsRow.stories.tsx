import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button'
import { ViewTabsRow } from './ViewTabsRow'

const tabs = [
  { value: 'polls', label: 'Polls', to: '/polls' },
  { value: 'players', label: 'Players', to: '/players' },
  { value: 'cover', label: 'Match-Day Cover', to: '/cover' },
]

const meta: Meta<typeof ViewTabsRow> = {
  title: 'Components/ViewTabsRow',
  component: ViewTabsRow,
  args: { 'aria-label': 'Views', value: 'polls', tabs },
}
export default meta

type Story = StoryObj<typeof ViewTabsRow>

export const Default: Story = {}

export const WithAction: Story = {
  args: { value: 'players', children: <Button size="compact" variant="secondary" sx={{ ml: 'auto' }}>Jump To Today</Button> },
}

export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } }
