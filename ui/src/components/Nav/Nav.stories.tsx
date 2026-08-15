import type { Meta, StoryObj } from '@storybook/react-vite'
import { Nav } from './Nav'

const meta: Meta<typeof Nav> = {
  title: 'Components/Nav',
  component: Nav,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof Nav>

const items = [
  { label: 'Matches', to: '/matches' },
  { label: 'Teams', to: '/teams' },
  { label: 'Stats', to: '/stats' },
]

export const Mobile: Story = {
  args: { items },
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const Desktop: Story = {
  args: { items },
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
