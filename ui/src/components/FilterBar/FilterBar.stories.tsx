import { useState } from 'react'
import { FormControlLabel, Switch } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FilterBar } from './FilterBar'
import type { FilterBarProps } from './FilterBar'
import type { Section } from '../../api/sectionApi'

function makeSection(overrides: Partial<Section>): Section {
  return {
    id: 'section',
    clubId: 'club-1',
    parentSectionId: null,
    name: 'Section',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const SECTIONS = [
  makeSection({ id: 'vets', name: 'Vets' }),
  makeSection({ id: 'over40', name: 'Over 40', parentSectionId: 'vets' }),
  makeSection({ id: 'juniors', name: 'Juniors' }),
]
const LEAGUES = [
  { id: 'l1', name: 'Over 40 League' },
  { id: 'l2', name: 'Premier League' },
]
const TEAMS = [
  { id: 't1', name: 'Irene Villagers 1' },
  { id: 't2', name: 'Irene Villagers 2' },
]

const meta: Meta<typeof FilterBar> = {
  title: 'Components/FilterBar',
  component: FilterBar,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof FilterBar>

function Interactive(args: FilterBarProps) {
  const [leagueId, setLeagueId] = useState<string | null>('l1')
  const [sectionId, setSectionId] = useState<string | null>('over40')
  const [teamId, setTeamId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [past, setPast] = useState(false)
  return (
    <FilterBar
      {...args}
      leagueId={leagueId}
      sectionId={sectionId}
      teamId={teamId}
      onLeagueChange={setLeagueId}
      onSectionChange={setSectionId}
      onTeamChange={setTeamId}
      searchValue={search}
      onSearchChange={setSearch}
      onClearAll={() => {
        setLeagueId(null)
        setSectionId(null)
        setTeamId(null)
      }}
      viewControls={<FormControlLabel control={<Switch checked={past} onChange={(e) => setPast(e.target.checked)} />} label="Show past games" />}
    />
  )
}

const base: FilterBarProps = {
  leagues: LEAGUES,
  sections: SECTIONS,
  teams: TEAMS,
  searchPlaceholder: 'Search players',
  onClearAll: () => undefined,
}

// League, Section, Team and search (the Players view). On a 375 px viewport it becomes search plus a
// Filters button with a badge, a bottom sheet and removable chips.
export const AllFilters: Story = { args: base, render: (args) => <Interactive {...args} /> }

// The Coverage view: no Team, no search.
// docs/specs/085 (I): the compact density the Availability pages use - 8 px panel padding and gap, 36 px fields.
export const Compact: Story = { args: { ...base, density: 'compact' }, render: (args) => <Interactive {...args} /> }

export const NoTeamNoSearch: Story = {
  args: { ...base, teams: undefined, searchPlaceholder: undefined },
  render: (args) => <Interactive {...args} />,
}

// The Polls view in slice 1: Section and search only.
export const SectionOnly: Story = {
  args: { ...base, leagues: undefined, teams: undefined },
  render: (args) => <Interactive {...args} />,
}

// docs/specs/087: search suggestions (Matches offers the club's team names) as a freeSolo Autocomplete.
export const WithSearchSuggestions: Story = {
  args: { ...base, density: 'compact', searchOptions: ['Irene Villagers 1', 'Irene Villagers 2', 'Riverside Occasionals'] },
  render: (args) => <Interactive {...args} />,
}

// docs/specs/087: the optional Season slot (Matches), between League and Section.
function WithSeasonsDemo(args: FilterBarProps) {
  const [seasonId, setSeasonId] = useState<string | null>('s1')
  return (
    <Interactive
      {...args}
      seasons={[
        { id: 's1', name: '2026/27' },
        { id: 's2', name: '2025/26' },
      ]}
      seasonId={seasonId}
      onSeasonChange={setSeasonId}
    />
  )
}

export const WithSeasons: Story = { args: { ...base, density: 'compact' }, render: (args) => <WithSeasonsDemo {...args} /> }

export const WithSeasonsMobile: Story = {
  args: base,
  parameters: { viewport: { defaultViewport: 'mobile' } },
  render: (args) => <WithSeasonsDemo {...args} />,
}

export const Mobile: Story = {
  args: base,
  parameters: { viewport: { defaultViewport: 'mobile' } },
  render: (args) => <Interactive {...args} />,
}
