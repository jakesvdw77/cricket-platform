import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { MatchForm } from './MatchForm'
import type { Team } from '../../api/teamApi'
import type { Season } from '../../api/seasonApi'
import type { League } from '../../api/leagueApi'

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
    ...overrides,
  }
}

const TEAMS: Team[] = [makeTeam({ id: 'team-1', name: '1st XI' }), makeTeam({ id: 'team-2', name: '2nd XI' })]
const SEASONS: Season[] = [makeSeason({ id: 'season-1', label: '2026' })]
const LEAGUES: League[] = [makeLeague({ id: 'league-1', name: 'Internal League' })]

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
  args: { teams: TEAMS, seasons: SEASONS, leagues: LEAGUES, onSubmit: () => undefined },
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
