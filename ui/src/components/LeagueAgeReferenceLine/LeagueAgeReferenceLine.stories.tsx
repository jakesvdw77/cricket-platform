import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LeagueAgeReferenceLine } from './LeagueAgeReferenceLine'
import { ageReferenceKey } from '../../api/leagueApi'
import type { AgeReference } from '../../api/leagueApi'

// The lookup is pre-seeded in the query cache so the story needs no server.
function withReference(reference: AgeReference) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(ageReferenceKey('club-1', 'league-1', 'season-1'), reference)
  return (Story: () => ReactElement) => (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  )
}

const meta: Meta<typeof LeagueAgeReferenceLine> = {
  title: 'Components/LeagueAgeReferenceLine',
  component: LeagueAgeReferenceLine,
  args: { clubId: 'club-1', leagueId: 'league-1', seasonId: 'season-1', hasAgeLimit: true },
}
export default meta

type Story = StoryObj<typeof LeagueAgeReferenceLine>

export const Cutoff: Story = {
  decorators: [withReference({ referenceDate: '2026-12-31', source: 'CUTOFF', leagueStart: '2026-09-05', leagueStartSource: 'FIRST_MATCH' })],
}

export const LeagueStart: Story = {
  decorators: [withReference({ referenceDate: '2027-07-14', source: 'LEAGUE_START', leagueStart: '2027-07-14', leagueStartSource: 'SEASON_START' })],
}
