import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import { MatchForm } from './MatchForm'
import type { Team } from '../../api/teamApi'
import type { Season } from '../../api/seasonApi'
import type { League } from '../../api/leagueApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'
import type { LeagueTeam } from '../../api/leagueTeamApi'

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'club-1',
    sectionId: 'section-1',
    name: '1st XI',
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
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
    matchCount: null,
    playedCount: null,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: null,
    teams: null,
    format: null,
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
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

function makeLeagueTeam(overrides: Partial<LeagueTeam> = {}): LeagueTeam {
  return {
    id: 'lt-1',
    leagueId: 'league-1',
    seasonId: 'season-1',
    name: 'Centurion Brits CC',
    abbreviation: 'CBC',
    logoUrl: null,
    active: true,
    referencedByMatchCount: 0,
    ...overrides,
  }
}

// One inactive entry: only offered when a side already holds it (docs/specs/070-league-teams.md).
const LEAGUE_TEAMS: LeagueTeam[] = [
  makeLeagueTeam({ id: 'lt-1', name: 'Centurion Brits CC', abbreviation: 'CBC' }),
  makeLeagueTeam({ id: 'lt-2', name: 'Laudium Cricket Club', abbreviation: 'LCC' }),
  makeLeagueTeam({ id: 'lt-3', name: 'Ladium', abbreviation: 'LAD', active: false }),
]

const meta: Meta<typeof MatchForm> = {
  title: 'Components/MatchForm',
  component: MatchForm,
  parameters: { layout: 'padded' },
  decorators: [
    // MemoryRouter: MatchSideFields renders a RouterLink in the empty league-team state.
    (Story) => (
      <MemoryRouter>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Story />
        </Box>
      </MemoryRouter>
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

// docs/specs/075-match-view-and-edit.md: the optional scoring and streaming links, prefilled.
export const WithLinks: Story = {
  args: {
    ...NewMatch.args,
    initialValues: {
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      seasonId: 'season-1',
      matchDate: '2026-06-01T14:30:00.000Z',
      scoringUrl: 'https://cricclubs.com/matches/34343',
      streamingUrl: 'https://pitchvision.example/live/1',
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

// docs/specs/070-league-teams.md: a club admin gets the three-way toggle (My team / League team /
// Other) per side.
export const ThreeWayToggle: Story = {
  args: { ...NewMatch.args, canUseLeagueTeams: true, leagueTeams: LEAGUE_TEAMS },
}

// League team mode: the grouped picker, Our teams then League teams. The home side already holds
// the inactive Ladium, shown with its Inactive suffix.
export const LeagueTeamPicker: Story = {
  args: {
    ...NewMatch.args,
    canUseLeagueTeams: true,
    leagueTeams: LEAGUE_TEAMS,
    initialValues: {
      seasonId: 'season-1',
      leagueId: 'league-1',
      homeTeamName: 'Ladium',
      homeLeagueTeamId: 'lt-3',
      awayTeamName: 'Centurion Brits CC',
      awayLeagueTeamId: 'lt-1',
    },
  },
}

// No league or season chosen yet: the League team button is disabled with a hint.
export const LeagueTeamNeedsLeagueAndSeason: Story = {
  args: { ...NewMatch.args, canUseLeagueTeams: true, leagueTeams: [] },
}

// A league and season with no registered league teams: helper text plus a link to the league.
export const LeagueTeamEmptyList: Story = {
  args: {
    ...NewMatch.args,
    canUseLeagueTeams: true,
    leagueTeams: [],
    initialValues: {
      seasonId: 'season-1',
      leagueId: 'league-1',
      homeTeamName: 'Pending',
      homeLeagueTeamId: 'lt-x',
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
