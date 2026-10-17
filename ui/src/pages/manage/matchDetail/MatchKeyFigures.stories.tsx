import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatchKeyFigures } from './MatchKeyFigures'

const meta: Meta<typeof MatchKeyFigures> = {
  title: 'Pages/MatchKeyFigures',
  component: MatchKeyFigures,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof MatchKeyFigures>

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

const base = {
  venue: 'Riverside Oval',
  leagueName: 'TVL Division 1 T20',
  seasonLabel: '2026/2027',
  pollsReady: true,
  polls: [{ type: 'SQUAD' as const, teamId: 't1', pollId: 'p1', roundId: null, open: true }],
  pollClosesAt: inDays(5),
}

export const DaysAway: Story = { args: { ...base, matchDate: inDays(6) } }

// Within 24 hours the Starts tile turns amber.
export const StartsSoon: Story = { args: { ...base, matchDate: new Date(Date.now() + 5 * 3_600_000).toISOString() } }

export const FriendlyWithNoPoll: Story = { args: { ...base, venue: null, leagueName: null, polls: [], pollClosesAt: null, matchDate: inDays(3) } }

// docs/specs/089 (Match page actions, 2026-10-16): the poll tile carries Open availability.
export const WithOpenAvailability: Story = { args: { ...base, matchDate: inDays(3), onOpenAvailability: () => {} } }

export const OpenAvailabilityDisabled: Story = {
  args: { ...base, polls: [], pollClosesAt: null, matchDate: inDays(3), onOpenAvailability: () => {}, availabilityDisabled: true, availabilityDisabledReason: 'None of your teams is playing in this match' },
}
