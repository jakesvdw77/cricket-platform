import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { MatchCard } from './MatchCard'
import { makeMatch, makeTeam, makeTeams, squadPoll } from './matchTestUtils'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'

const HOUR = 3_600_000
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

const teams = makeTeams(makeTeam('team-1', 'Riverside Vets A'), makeTeam('team-2', 'Riverside Vets B'))
const leagues = new Map([['league-1', { id: 'league-1', name: 'Saturday League Div 1' } as League]])
const seasons = new Map([['season-1', { id: 'season-1', label: '2026/27' } as Season]])

// The card opens a team-sheet dialog that queries on demand, so stories need a React Query client; the router
// comes from preview.
const meta: Meta<typeof MatchCard> = {
  title: 'Pages/Manage/MatchCard',
  component: MatchCard,
  parameters: { layout: 'padded' },
  decorators: [
    (StoryComponent) => (
      <QueryClientProvider client={new QueryClient()}>
        <Box sx={{ maxWidth: 420 }}>
          <StoryComponent />
        </Box>
      </QueryClientProvider>
    ),
  ],
  args: {
    clubId: 'club-1',
    teamsById: teams,
    leaguesById: leagues,
    seasonsById: seasons,
    editTo: '/manage/fixtures/matches/match-1/edit',
    viewTo: '/manage/fixtures/matches/match-1',
  },
}
export default meta

type Story = StoryObj<typeof MatchCard>

// docs/specs/087: kickoff more than a day away - neutral strip with a countdown.
export const StartsLater: Story = {
  args: { match: makeMatch({ matchDate: fromNow(120 * HOUR), leagueId: 'league-1', homePickedCount: 9, polls: [squadPoll()] }) },
}

// Within 24 hours of kickoff - the strip and countdown turn amber.
export const StartsWithin24Hours: Story = {
  args: { match: makeMatch({ matchDate: fromNow(20 * HOUR), leagueId: 'league-1', homePickedCount: 11, homeSideAnnounced: true, polls: [squadPoll()] }) },
}

// Two of the club's teams: two zebra Selection rows, team-prefixed announced badges.
export const Derby: Story = {
  args: {
    match: makeMatch({ matchDate: fromNow(48 * HOUR), awayTeamId: 'team-2', awayTeamName: null, homePickedCount: 11, awayPickedCount: 4, homeSideAnnounced: true }),
  },
}

// A started match (Show past matches): "Played", neutral, no countdown.
export const Played: Story = {
  args: { match: makeMatch({ matchDate: fromNow(-72 * HOUR), leagueId: 'league-1', homePickedCount: 11, polls: [squadPoll({ open: false })] }) },
}

// Neither side is one of the club's teams: the note, and Select / Availability / Share disabled.
export const NoClubTeam: Story = {
  args: { match: makeMatch({ matchDate: fromNow(96 * HOUR), homeTeamId: null, homeTeamName: 'Hillcrest CC', awayTeamName: 'Eastwood CC', homePickedCount: null }) },
}

export const WithScoringAndStreamingLinks: Story = {
  args: {
    match: makeMatch({ matchDate: fromNow(30 * HOUR), scoringUrl: 'https://example.com/score', streamingUrl: 'https://example.com/live', homePickedCount: 7 }),
  },
}

export const LongTitle: Story = {
  args: {
    match: makeMatch({
      matchDate: fromNow(200 * HOUR),
      homeTeamId: null,
      homeTeamName: 'Riverside Over 50s Development Side',
      awayTeamName: 'North Eastwood and District Cricket Club Second XI',
      homePickedCount: null,
      awayPickedCount: null,
      venue: 'North Eastwood Recreation Ground, Willow Lane Annexe',
    }),
  },
}
