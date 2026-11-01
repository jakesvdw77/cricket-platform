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

// docs/specs/130: the Venue counter is the one clickable card, a link to the field's page.
export const WithField: Story = { args: { ...base, matchDate: inDays(3), playingAreaId: 'field-1', playingAreaVerificationStatus: 'UNVERIFIED' } }

// docs/specs/131: the forecast badge under the counters (only within 7 days and with a usable field place).
export const WithForecast: Story = {
  args: { ...base, matchDate: inDays(3), weather: { label: 'Mostly sunny', icon: 'sunny', tempMin: 14, tempMax: 27, rainChance: 20, text: 'Mostly sunny, 14 to 27 degrees, 20% rain', short: '14 to 27 degrees, 20% rain' } },
}
