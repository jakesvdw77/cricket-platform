import type { Meta, StoryObj } from '@storybook/react-vite'
import { PollShareDialog } from './PollShareDialog'
import type { Match } from '../../api/matchApi'

const MATCH: Match = {
  id: 'match-1',
  clubId: 'club-1',
  homeTeamId: 'team-1',
  homeTeamName: null,
  awayTeamId: null,
  awayTeamName: 'Riverside CC',
  leagueId: null,
  seasonId: 'season-1',
  matchDate: '2026-10-04T09:00:00Z',
  venue: 'Central Oval',
  active: true,
  homeSideAnnounced: false,
  awaySideAnnounced: false,
  homePickedCount: null,
  awayPickedCount: null,
  playingXiSize: null,
  polls: [],
  homeTeamLogoUrl: null,
  awayTeamLogoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const meta: Meta<typeof PollShareDialog> = {
  title: 'Components/PollShareDialog',
  component: PollShareDialog,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PollShareDialog>

const noop = () => undefined

export const Open: Story = {
  args: {
    open: true,
    onClose: noop,
    match: MATCH,
    teamName: 'Home Firsts',
    pollId: 'poll-123',
  },
}

export const WithCloseTime: Story = {
  args: { ...Open.args, autoClose: true, scheduledCloseAt: '2026-10-03T09:00:00Z' },
}

export const MobileViewport: Story = {
  args: Open.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
