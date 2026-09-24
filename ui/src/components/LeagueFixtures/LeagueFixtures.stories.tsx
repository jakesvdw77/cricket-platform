import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { LeagueFixtures } from './LeagueFixtures'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'

const IRENE_VILLAGERS_1: Team = {
  id: 'team-iv1',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Irene Villagers 1st XI',
  logoUrl: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const IRENE_VILLAGERS_2: Team = {
  id: 'team-iv2',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Irene Villagers 2nd XI',
  logoUrl: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const TEAMS_BY_ID = new Map<string, Team>([
  [IRENE_VILLAGERS_1.id, IRENE_VILLAGERS_1],
  [IRENE_VILLAGERS_2.id, IRENE_VILLAGERS_2],
])

function match(overrides: Partial<Match> & Pick<Match, 'id' | 'matchDate'>): Match {
  return {
    clubId: 'club-1',
    homeTeamId: null,
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: null,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    leagueId: 'league-1',
    seasonId: 'season-1',
    venue: null,
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// Two fixtures on the same Saturday — one real-Team-vs-external (with a logo), one real-Team-vs-
// external (no logo, falls back to initials) — plus one a week later, exercising the date-grouping
// (two headings) and both avatar-resolution paths in one story.
const SEASON_FIXTURES: Match[] = [
  match({
    id: 'match-1',
    matchDate: '2026-03-14T14:00:00Z',
    homeTeamId: IRENE_VILLAGERS_1.id,
    awayTeamName: 'Riverside Occasionals',
    awayTeamLogoUrl: '/media/riverside-occasionals-logo.png',
    venue: 'Irene Country Club',
  }),
  match({
    id: 'match-2',
    matchDate: '2026-03-14T10:00:00Z',
    homeTeamId: IRENE_VILLAGERS_2.id,
    awayTeamName: 'Centurion Thursdays',
    venue: 'Centurion Oval',
  }),
  match({
    id: 'match-3',
    matchDate: '2026-03-21T13:00:00Z',
    homeTeamName: 'Wanderers Pioneers',
    homeTeamLogoUrl: '/media/wanderers-pioneers-logo.png',
    awayTeamId: IRENE_VILLAGERS_1.id,
    venue: 'The Wanderers',
  }),
]

const meta: Meta<typeof LeagueFixtures> = {
  title: 'Components/LeagueFixtures',
  component: LeagueFixtures,
  parameters: { layout: 'padded' },
  // This component always sits inside a page section (LeagueFormPage's Schedule tab,
  // LeagueDetailPage's Fixtures section) — same width-constraint decorator convention
  // AvailabilityRespondentAvatars.stories.tsx uses for its own section-embedded component.
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 640 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof LeagueFixtures>

export const Fixtures: Story = {
  args: { matches: SEASON_FIXTURES, teamsById: TEAMS_BY_ID },
}

export const SingleFixture: Story = {
  args: { matches: [SEASON_FIXTURES[0]], teamsById: TEAMS_BY_ID },
}

export const Empty: Story = {
  args: { matches: [], teamsById: TEAMS_BY_ID },
}

export const MobileViewport: Story = {
  args: Fixtures.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Fixtures.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Fixtures.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
