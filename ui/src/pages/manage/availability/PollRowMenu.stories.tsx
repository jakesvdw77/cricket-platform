import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { PollRowMenu } from './PollRowMenu'
import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'

const HOUR = 3_600_000
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

const poll: OpenAvailabilityPoll = {
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

// docs/specs/136 and page-anatomy section 6: the one dense kebab of a poll row. Open it for Open Responses first and Share Invite last.
const meta: Meta<typeof PollRowMenu> = {
  title: 'Pages/Manage/PollRowMenu',
  component: PollRowMenu,
  parameters: { layout: 'padded' },
  decorators: [
    (StoryComponent) => (
      <QueryClientProvider client={new QueryClient()}>
        <Box sx={{ position: 'relative', display: 'inline-block', p: 2 }}>
          <StoryComponent />
        </Box>
      </QueryClientProvider>
    ),
  ],
  args: { clubId: 'club-1', item: { kind: 'SQUAD', poll }, teamsById: new Map(), onChanged: () => undefined },
}
export default meta

type Story = StoryObj<typeof PollRowMenu>

export const Squad: Story = {}

export const Group: Story = {
  args: {
    item: {
      kind: 'GROUP',
      round: {
        id: 'round-1',
        description: 'Over 40s weekend',
        open: true,
        autoClose: true,
        scheduledCloseAt: fromNow(48 * HOUR),
        firstMatchKickoff: fromNow(96 * HOUR),
        canReopen: true,
        sectionId: 's1',
        sectionName: 'Over 40',
        firstMatchDate: '2030-06-01',
        lastMatchDate: '2030-06-01',
        brackets: [],
      } as never,
    },
  },
}
