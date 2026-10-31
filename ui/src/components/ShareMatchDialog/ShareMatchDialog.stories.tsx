import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShareMatchDialog } from './ShareMatchDialog'
import type { Team } from '../../api/teamApi'
import { shareSettingsKey } from '../../api/shareSettingsApi'
import { fixtureMatch, fixtureSide } from '../../utils/share/matchShareFixture'

// Every read the dialog makes is answered from a seeded cache, so the stories need no server. Viewports 375, 768 and 1280.
const pad = (value: number) => String(value).padStart(2, '0')
const inDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:15:00`
}

const teamsById = new Map<string, Team>([['t-home', { id: 't-home', clubId: 'club-1', sectionId: 'sec-1', name: 'Irene Villagers U15', logoUrl: null } as Team]])

const seeded = (): QueryClient => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(shareSettingsKey('club-1'), { initialsOnlyDefault: false, disabledFormats: {} })
  client.setQueryData(['managed-club', 'club-1', 'leagues'], [{ id: 'l1', name: 'Diamond League U15 T20', maxAge: 15 }])
  client.setQueryData(['managed-club', 'club-1', 'sections'], [{ id: 'sec-1', parentSectionId: null, name: 'U15', maxAge: 15 }])
  client.setQueryData(['managed-club', 'club-1', 'profile'], { name: 'Irene Villagers CC', logoUrl: null, website: 'https://irene-villagers.example' })
  client.setQueryData(['managed-club', 'club-1', 'sponsors'], [])
  client.setQueryData(['managed-club', 'club-1', 'results', 'match-share', 't-home'], { content: [] })
  return client
}

interface Args {
  selected: boolean
  days: number
  initialContent?: 'TEAM_SELECTION' | 'COUNTDOWN' | 'FUN_FACTS' | 'FIXTURE' | 'TEAM_SHEET'
}

const meta: Meta<Args> = {
  title: 'Components/ShareMatchDialog',
  parameters: { layout: 'fullscreen' },
  args: { selected: true, days: 3 },
  render: ({ selected, days, initialContent }) => (
    <QueryClientProvider client={seeded()}>
      <ShareMatchDialog
        open
        onClose={() => undefined}
        clubId="club-1"
        match={fixtureMatch({ matchDate: inDays(days) })}
        teamsById={teamsById}
        sides={[fixtureSide('t-home', 'Irene Villagers U15', 0, selected), fixtureSide('t-away', 'Pretoria A', 5, false)]}
        sidesLoading={false}
        leagueName="Diamond League U15 T20"
        seasonLabel="2026/2027"
        initialContent={initialContent}
      />
    </QueryClientProvider>
  ),
}
export default meta

type Story = StoryObj<Args>

// Step 1 with a selected XI: every content available.
export const WhatToShare: Story = {}
// Step 1 before a team is selected: the poster and team sheet say why they are off; fixture, countdown and facts work.
export const BeforeTeamIsSelected: Story = { args: { selected: false } }
// A past match: no countdown.
export const PastMatch: Story = { args: { days: -2 } }
// The Team Sheet button of a team panel: Team Sheet ticked.
export const TeamSheetPreselected: Story = { args: { initialContent: 'TEAM_SHEET' } }
