import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { ShareLeagueDialog } from './ShareLeagueDialog'
import type { League } from '../../api/leagueApi'
import type { Match } from '../../api/matchApi'
import { leagueSeasonDatesKey } from '../../api/leagueSeasonDatesApi'
import { leagueTeamsQueryKey } from '../../api/leagueTeamApi'
import { resultsKey } from '../../api/matchResultApi'
import { shareSettingsKey } from '../../api/shareSettingsApi'

const league = {
  id: 'league-1',
  clubId: 'club-1',
  name: 'Summer Premier League',
  maxAge: null,
  minAge: null,
  format: null,
  logoUrl: null,
  phone: null,
  email: null,
  website: null,
  socialLinks: [],
  active: true,
} as unknown as League

const matches = [
  { id: 'm1', homeTeamId: 't1', homeTeamName: 'Riverside 1', awayTeamId: null, awayTeamName: 'Hilltop', matchDate: '2026-11-14T14:00:00', venue: 'Main oval', active: true, leagueId: 'league-1', seasonId: 's1' },
  { id: 'm2', homeTeamId: null, homeTeamName: 'Lakeside', awayTeamId: 't1', awayTeamName: 'Riverside 1', matchDate: '2026-11-21T14:00:00', venue: null, active: true, leagueId: 'league-1', seasonId: 's1' },
] as unknown as Match[]

// Every read the dialog makes is answered from a seeded cache, so the stories need no server.
const seeded = (): QueryClient => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(shareSettingsKey('club-1'), { initialsOnlyDefault: false, disabledFormats: {} })
  client.setQueryData(['managed-club', 'club-1', 'seasons'], [{ id: 's1', label: '2026/27', startDate: '2026-11-01', endDate: '2027-03-31', active: true }])
  client.setQueryData(['managed-club', 'club-1', 'teams'], [{ id: 't1', clubId: 'club-1', sectionId: 'sec-1', name: 'Riverside 1', logoUrl: null, abbreviation: null, active: true }])
  client.setQueryData(['managed-club', 'club-1', 'leagues', 'league-1', 'affiliations'], [{ id: 'a1', leagueId: 'league-1', teamId: 't1', seasonId: 's1' }])
  client.setQueryData(['managed-club', 'club-1', 'leagues', 'league-1', 'contacts'], [])
  client.setQueryData([...leagueTeamsQueryKey('club-1', 'league-1', 's1'), 'active'], [{ id: 'lt1', name: 'Hilltop', abbreviation: null, logoUrl: null, active: true }])
  client.setQueryData(['managed-club', 'club-1', 'leagues', 'league-1', 'matches', 's1'], matches)
  client.setQueryData([...resultsKey('club-1'), 'league-published', 'league-1', 's1'], [])
  client.setQueryData(leagueSeasonDatesKey('club-1', 'league-1', 's1'), { startDate: '2026-11-01', endDate: '2027-03-31' })
  client.setQueryData(['managed-club', 'club-1', 'leagues', 'league-1', 'playing-conditions', 's1'], null)
  client.setQueryData(['managed-club', 'club-1', 'sections'], [{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }])
  client.setQueryData(['managed-club', 'club-1', 'profile'], { name: 'Riverside CC', logoUrl: null, website: 'https://riverside-cc.example' })
  client.setQueryData(['managed-club', 'club-1', 'sponsors'], [])
  return client
}

const client = seeded()

const meta: Meta<typeof ShareLeagueDialog> = {
  title: 'Components/ShareLeagueDialog',
  component: ShareLeagueDialog,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onClose: () => {},
    clubId: 'club-1',
    league,
    seasonId: 's1',
    preselected: ['DETAILS', 'SCHEDULE'],
  },
}
export default meta

type Story = StoryObj<typeof ShareLeagueDialog>

export const Default: Story = {}
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }

// No season given: the Season pill shows at the top of step 1.
export const WithoutSeason: Story = { args: { seasonId: null } }

// Step 2 with Schedule and Teams ticked: Calendar greyed with its reason.
export const FormatStep: Story = {
  args: { preselected: ['TEAMS', 'SCHEDULE'] },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('button', { name: 'Next' }))
  },
}
