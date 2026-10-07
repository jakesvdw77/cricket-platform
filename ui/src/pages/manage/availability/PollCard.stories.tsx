import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { PollCard } from './PollCard'
import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'

const HOUR = 3_600_000
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

const basePoll: OpenAvailabilityPoll = {
  pollId: 'poll-1',
  matchId: 'match-1',
  teamId: 'team-home',
  homeTeamId: 'team-home',
  homeTeamName: 'Villagers 1',
  awayTeamId: null,
  awayTeamName: 'CBC',
  matchDate: fromNow(60 * HOUR),
  venue: 'Central Oval',
  autoClose: true,
  scheduledCloseAt: fromNow(72 * HOUR),
  canReopen: true,
  availableCount: 5,
  unavailableCount: 2,
  unsureCount: 1,
  noResponseCount: 10,
  availableRespondents: [],
  unavailableRespondents: [],
  unsureRespondents: [],
}

// The card owns its mutations, so stories need a React Query client; the router comes from preview.
const meta: Meta<typeof PollCard> = {
  title: 'Pages/Manage/PollCard',
  component: PollCard,
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
  args: { clubId: 'club-1', teamsById: new Map(), onChanged: () => undefined },
}
export default meta

type Story = StoryObj<typeof PollCard>

export const Open: Story = { args: { item: { kind: 'SQUAD', poll: basePoll }, open: true } }

export const ClosingSoon: Story = {
  args: { item: { kind: 'SQUAD', poll: { ...basePoll, scheduledCloseAt: fromNow(5 * HOUR + 12 * 60_000) } }, open: true },
}

export const Closed: Story = { args: { item: { kind: 'SQUAD', poll: basePoll }, open: false } }

export const ClosedNotReopenable: Story = {
  args: { item: { kind: 'SQUAD', poll: { ...basePoll, canReopen: false } }, open: false },
}
