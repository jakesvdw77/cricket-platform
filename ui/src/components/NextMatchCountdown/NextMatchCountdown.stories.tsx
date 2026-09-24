import type { Meta, StoryObj } from '@storybook/react-vite'
import { NextMatchCountdown } from './NextMatchCountdown'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'

const homeTeam: Team = {
  id: 'team-home',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Riverside 1st XI',
  logoUrl: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

const teamsById = new Map<string, Team>([[homeTeam.id, homeTeam]])

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'match-1',
    clubId: 'club-1',
    homeTeamId: 'team-home',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Coastal CC',
    leagueId: 'league-1',
    seasonId: 'season-1',
    matchDate: '2026-03-14T10:00:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

const meta: Meta<typeof NextMatchCountdown> = {
  title: 'Components/NextMatchCountdown',
  component: NextMatchCountdown,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof NextMatchCountdown>

export const InDays: Story = {
  args: {
    countdown: { match: makeMatch({}), label: 'days', value: 12 },
    teamsById,
  },
}

export const Today: Story = {
  args: {
    countdown: { match: makeMatch({}), label: 'today' },
    teamsById,
  },
}

export const Tomorrow: Story = {
  args: {
    countdown: { match: makeMatch({}), label: 'tomorrow' },
    teamsById,
  },
}

// Renders nothing given a null countdown — the host page conditionally renders this component,
// LeagueFixtures' own EmptyState already covers "nothing scheduled at all".
export const NoUpcomingMatch: Story = {
  args: {
    countdown: null,
    teamsById,
  },
}

export const MobileViewport: Story = {
  args: InDays.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: InDays.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: InDays.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
