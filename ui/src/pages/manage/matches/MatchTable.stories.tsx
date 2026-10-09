import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatchTable } from './MatchTable'
import { groupPoll, makeMatch, makeTeam, makeTeams, squadPoll } from './matchTestUtils'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'

const HOUR = 3_600_000
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

const teams = makeTeams(makeTeam('team-1', 'Riverside Vets A'), makeTeam('team-2', 'Riverside Vets B'))
const leagues = new Map([['league-1', { id: 'league-1', name: 'TVL Division 1 T20' } as League]])
const seasons = new Map([['season-1', { id: 'season-1', label: '2026/27' } as Season]])

const meta: Meta<typeof MatchTable> = {
  title: 'Pages/Manage/MatchTable',
  component: MatchTable,
  parameters: { layout: 'padded' },
  args: {
    teamsById: teams,
    leaguesById: leagues,
    seasonsById: seasons,
    viewTo: (match) => `/manage/fixtures/matches/${match.id}`,
  },
}
export default meta

type Story = StoryObj<typeof MatchTable>

// docs/specs/089 (C): zebra rows; the second starts within 24 hours (amber); a derby shows both sides' picked counts.
export const Default: Story = {
  args: {
    matches: [
      makeMatch({ id: 'm1', leagueId: 'league-1', matchDate: fromNow(6 * 24 * HOUR), homePickedCount: 10, playingXiSize: 12, polls: [squadPoll()] }),
      makeMatch({ id: 'm2', matchDate: fromNow(5 * HOUR), homePickedCount: 3, playingXiSize: 12 }),
      makeMatch({ id: 'm3', leagueId: 'league-1', awayTeamId: 'team-2', awayTeamName: null, matchDate: fromNow(8 * 24 * HOUR), homePickedCount: 12, awayPickedCount: 8, playingXiSize: 12, homeSideAnnounced: true, polls: [groupPoll({ open: false })] }),
      makeMatch({ id: 'm4', matchDate: fromNow(-3 * HOUR), homePickedCount: 12, playingXiSize: 12, active: false }),
    ],
  },
}
