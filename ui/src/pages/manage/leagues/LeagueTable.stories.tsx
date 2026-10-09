import type { Meta, StoryObj } from '@storybook/react-vite'
import { LeagueTable } from './LeagueTable'
import type { League } from '../../../api/leagueApi'

const HOUR = 3_600_000
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

function league(overrides: Partial<League>): League {
  return {
    id: 'l',
    clubId: 'c',
    name: 'League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    currentSeasonTeamCount: 0,
    currentSeasonLabel: '2026/2027',
    currentSeasonPlayingConditionsUrl: null,
    matchCount: 0,
    playedCount: 0,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: null,
    teams: [],
    format: 'T20',
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
    ...overrides,
  }
}

const team = (name: string, own: boolean) => ({ name, abbreviation: null, logoUrl: null, own })

const meta: Meta<typeof LeagueTable> = {
  title: 'Pages/Manage/LeagueTable',
  component: LeagueTable,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof LeagueTable>

// docs/specs/091 (A): zebra rows; the second has its next match within 24 hours (amber); the last is retired with no matches.
export const Default: Story = {
  args: {
    seasonId: 'season-1',
    leagues: [
      league({ id: 'a', name: 'TVL Division 1 T20', matchCount: 56, playedCount: 12, nextMatchDate: fromNow(120 * HOUR), teams: [team('A', true), team('B', false)] }),
      league({ id: 'b', name: 'Vets Winter League', matchCount: 30, playedCount: 3, nextMatchDate: fromNow(7 * HOUR), teams: [team('A', true)] }),
      league({ id: 'c', name: 'Junior Cup U15', format: null, matchCount: 28, playedCount: 0, nextMatchDate: fromNow(360 * HOUR), teams: [team('A', true)] }),
      league({ id: 'd', name: 'Legacy Cup 2019', active: false }),
    ],
  },
}
