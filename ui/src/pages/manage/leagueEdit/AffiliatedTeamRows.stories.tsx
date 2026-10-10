import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AffiliatedTeamRows } from './AffiliatedTeamRows'
import type { LeagueAffiliation } from '../../../api/leagueAffiliationApi'
import type { Team } from '../../../api/teamApi'

const team = (id: string, name: string) => ({ id, name, sectionId: 'sec-1', logoUrl: null }) as unknown as Team
const affiliation = (id: string, teamId: string) =>
  ({ id, leagueId: 'league-1', teamId, seasonId: 'season-1', createdAt: '', createdBy: null }) as LeagueAffiliation

const meta: Meta<typeof AffiliatedTeamRows> = {
  title: 'Pages/Manage/AffiliatedTeamRows',
  component: AffiliatedTeamRows,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof AffiliatedTeamRows>

// docs/specs/095: the club's teams in the selected season, with Edit and Unaffiliate on each row.
export const Default: Story = {
  args: {
    clubId: 'club-1',
    leagueId: 'league-1',
    seasonLabel: '2026/27',
    canAdd: true,
    affiliations: [affiliation('a1', 't1'), affiliation('a2', 't2'), affiliation('a3', 't3')],
    teamsById: new Map([
      ['t1', team('t1', '1st XI')],
      ['t2', team('t2', '2nd XI')],
      ['t3', team('t3', 'Under 15 Boys')],
    ]),
    onAddTeam: () => undefined,
    onUnlinked: () => undefined,
  },
}

// The quiet empty line, with Add team still in the header.
export const Empty: Story = { args: { ...Default.args, affiliations: [] } }

export const Phone: Story = { args: Default.args, parameters: { viewport: { defaultViewport: 'mobile' } } }
