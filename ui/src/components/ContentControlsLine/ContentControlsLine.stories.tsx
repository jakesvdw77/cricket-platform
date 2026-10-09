import { CompactSwitch } from '../CompactSwitch'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ContentControlsLine, SortLink, SortMenu } from './ContentControlsLine'

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

// docs/specs/088: a list that sorts by more than one thing (Players: name, or games this season).
function PlayersSort() {
  const [value, setValue] = useState('name-asc')
  return (
    <ContentControlsLine
      scope="Showing 46 players"
      sortAction={
        <SortMenu
          value={value}
          onChange={setValue}
          options={[
            { value: 'name-asc', label: 'Name, A to Z', linkLabel: 'A to Z' },
            { value: 'name-desc', label: 'Name, Z to A', linkLabel: 'Z to A' },
            { value: 'season-desc', label: 'Games this season, most first', linkLabel: 'most games' },
            { value: 'season-asc', label: 'Games this season, fewest first', linkLabel: 'fewest games' },
          ]}
        />
      }
    />
  )
}

export const WithSortMenu: Story = { render: () => <PlayersSort /> }

