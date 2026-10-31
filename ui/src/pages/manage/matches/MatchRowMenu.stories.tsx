import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MatchRowMenu } from './MatchRowMenu'
import { groupPoll, makeMatch, makeTeam, makeTeams, squadPoll } from './matchTestUtils'

const HOUR = 3_600_000
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

const meta: Meta<typeof MatchRowMenu> = {
  title: 'Pages/Manage/MatchRowMenu',
  component: MatchRowMenu,
  parameters: { layout: 'centered' },
  decorators: [(StoryComponent) => <QueryClientProvider client={new QueryClient()}><StoryComponent /></QueryClientProvider>],
  args: {
    clubId: 'club-1',
    teamsById: makeTeams(makeTeam('team-1', 'Riverside Vets A'), makeTeam('team-2', 'Riverside Vets B')),
    leaguesById: new Map(),
    seasonsById: new Map(),
  },
}
export default meta

type Story = StoryObj<typeof MatchRowMenu>

// docs/specs/130: the ONE actions kebab of a match row or card. A match that has not started yet.
export const Upcoming: Story = { args: { match: makeMatch({ matchDate: fromNow(48 * HOUR), polls: [squadPoll()] }) } }

// A started match with no result: Capture Result and Import Result are offered.
export const AwaitingResult: Story = { args: { match: makeMatch({ matchDate: fromNow(-48 * HOUR) }) } }

// Scoring and Watch Live appear when the match has the links.
export const WithLinks: Story = {
  args: { match: makeMatch({ matchDate: fromNow(30 * HOUR), scoringUrl: 'https://example.com/score', streamingUrl: 'https://example.com/live' }) },
}

// A derby with a poll per side lists one Open Availability item per poll.
export const DerbyTwoPolls: Story = {
  args: {
    match: makeMatch({ matchDate: fromNow(72 * HOUR), awayTeamId: 'team-2', awayTeamName: null, polls: [squadPoll(), groupPoll({ teamId: null })] }),
  },
}

// Neither side is one of the club's teams: Select Team, Open Availability and Share Team Sheet are disabled with the reason.
export const NoClubTeam: Story = {
  args: { match: makeMatch({ matchDate: fromNow(96 * HOUR), homeTeamId: null, homeTeamName: 'Hillcrest CC', awayTeamName: 'Eastwood CC' }) },
}
