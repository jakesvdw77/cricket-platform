import type { Meta, StoryObj } from '@storybook/react-vite'
import { LeagueFixturesTable } from './LeagueFixturesTable'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'

const teamsById = new Map<string, Team>([['t1', { id: 't1', name: 'Irene Villagers 1', logoUrl: null } as Team]])

function match(overrides: Partial<Match>): Match {
  return {
    id: 'm',
    homeTeamId: null,
    homeTeamName: 'Centurion',
    homeTeamLogoUrl: null,
    awayTeamId: null,
    awayTeamName: 'Benoni',
    awayTeamLogoUrl: null,
    homeLeagueTeamId: null,
    awayLeagueTeamId: null,
    venue: 'Centurion Park',
    matchDate: '2099-10-17T09:00:00',
    ...overrides,
  } as Match
}

const meta: Meta<typeof LeagueFixturesTable> = {
  title: 'Pages/Manage/LeagueFixturesTable',
  component: LeagueFixturesTable,
  parameters: { layout: 'padded' },
  args: { teamsById },
}
export default meta

type Story = StoryObj<typeof LeagueFixturesTable>

// docs/specs/091 (C): zebra rows; our matches carry the chip and open the match, the others are plain rows.
export const Default: Story = {
  args: {
    matches: [
      match({ id: 'a', homeTeamId: 't1', homeTeamName: null, awayTeamName: 'POHBS', venue: 'Riverside Oval' }),
      match({ id: 'b' }),
      match({ id: 'c', homeTeamId: 't1', homeTeamName: null, awayTeamName: 'Kempton Park', venue: null, matchDate: '2099-10-24T09:00:00' }),
      match({ id: 'd', homeTeamName: 'Wanderers', awayTeamName: 'Centurion', venue: 'Wanderers Ground', matchDate: '2099-10-24T09:00:00' }),
    ],
  },
}
