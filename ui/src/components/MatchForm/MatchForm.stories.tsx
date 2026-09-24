import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { MatchForm } from './MatchForm'
import type { Team } from '../../api/teamApi'
import type { Season } from '../../api/seasonApi'
import type { League } from '../../api/leagueApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'club-1',
    sectionId: 'section-1',
    name: '1st XI',
    logoUrl: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'club-1',
    label: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'club-1',
    name: 'Internal League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    allowSubstitutions: false,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    currentSeasonTeamCount: 2,
    currentSeasonLabel: '2026',
    currentSeasonPlayingConditionsUrl: null,
    ...overrides,
  }
}

function makeAffiliation(overrides: Partial<LeagueAffiliation> = {}): LeagueAffiliation {
  return {
    id: 'affiliation-1',
    leagueId: 'league-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: null,
    ...overrides,
  }
}

const TEAMS: Team[] = [
  makeTeam({ id: 'team-1', name: '1st XI' }),
  makeTeam({ id: 'team-2', name: '2nd XI' }),
  makeTeam({ id: 'team-3', name: 'O/13A' }),
]
const SEASONS: Season[] = [makeSeason({ id: 'season-1', label: '2026' })]
const LEAGUES: League[] = [makeLeague({ id: 'league-1', name: 'Internal League' })]
// Only team-1/team-2 are entered into league-1 for season-1 — team-3 exists at the club but plays
// in a different League/Section, demonstrating the narrowing in NarrowedByAffiliation below.
const AFFILIATIONS: LeagueAffiliation[] = [
  makeAffiliation({ id: 'affiliation-1', teamId: 'team-1' }),
  makeAffiliation({ id: 'affiliation-2', teamId: 'team-2' }),
]

const meta: Meta<typeof MatchForm> = {
  title: 'Components/MatchForm',
  component: MatchForm,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MatchForm>

export const NewMatch: Story = {
  args: { teams: TEAMS, seasons: SEASONS, leagues: LEAGUES, affiliations: AFFILIATIONS, onSubmit: () => undefined },
}

// docs/specs/029-league-management.md: once both League and Season are picked, Home/Away team
// options narrow to only the teams actually affiliated with that League for that Season — team-3
// ("O/13A", not affiliated with league-1/season-1) is offered by NewMatch above (no League/Season
// picked yet) but not here.
export const NarrowedByAffiliation: Story = {
  args: {
    ...NewMatch.args,
    initialValues: { seasonId: 'season-1', leagueId: 'league-1' },
  },
}

export const TeamVsTeam: Story = {
  args: {
    ...NewMatch.args,
    initialValues: {
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      seasonId: 'season-1',
      leagueId: 'league-1',
      matchDate: '2026-06-01T14:30:00.000Z',
      venue: 'Riverside Oval',
    },
  },
}

export const ExternalOpponent: Story = {
  args: {
    ...NewMatch.args,
    initialValues: {
      homeTeamId: 'team-1',
      awayTeamName: 'Riverside Occasionals',
      seasonId: 'season-1',
      matchDate: '2026-06-01T14:30:00.000Z',
    },
  },
}

export const MobileViewport: Story = {
  args: NewMatch.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: NewMatch.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: NewMatch.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
