import { CompactSwitch } from '../CompactSwitch'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ContentControlsLine, SortLink } from './ContentControlsLine'

const meta: Meta<typeof ContentControlsLine> = {
  title: 'Components/ContentControlsLine',
  component: ContentControlsLine,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ContentControlsLine>

const toggle = (label: string, checked = false) => (
  <CompactSwitch checked={checked} onChange={() => undefined} label={label} />
)

export const Polls: Story = {
  args: {
    scope: 'Showing 2 open polls · Vets › Over 40',
    sortAction: <SortLink label="soonest first" onToggle={() => undefined} />,
    controls: (
      <>
        {toggle('Group polls', true)}
        {toggle('Squad polls', true)}
        {toggle('Show closed polls')}
      </>
    ),
  },
}

export const Players: Story = {
  args: { scope: 'Showing 18 players · 6 games', controls: <>{toggle('Show past games')}{toggle('Hide players with no answers')}</> },
}
