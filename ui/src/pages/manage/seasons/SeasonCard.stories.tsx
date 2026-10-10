import type { Meta, StoryObj } from '@storybook/react-vite'
import { SeasonCard } from './SeasonCard'
import type { Season, SeasonSummary } from '../../../api/seasonApi'

const TODAY = '2026-10-10'

function season(overrides: Partial<Season>): Season {
  return {
    id: 's',
    clubId: 'c',
    label: '2026/27',
    startDate: '2026-09-01',
    endDate: '2027-03-31',
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

const SUMMARY: SeasonSummary = { seasonId: 's', leagueCount: 2, teamsEntered: 5, matchCount: 48 }

const meta: Meta<typeof SeasonCard> = {
  title: 'Pages/Manage/SeasonCard',
  component: SeasonCard,
  parameters: { layout: 'padded' },
  args: { today: TODAY, summary: SUMMARY },
}
export default meta

type Story = StoryObj<typeof SeasonCard>

// docs/specs/094 (B): the current season, with the day-of-season bar.
export const Current: Story = { args: { season: season({}) } }

// Ends within 7 days: the time strip turns amber.
export const EndingSoon: Story = { args: { season: season({ label: '2026', startDate: '2026-04-01', endDate: '2026-10-15' }) } }

export const Upcoming: Story = { args: { season: season({ label: '2027/28', startDate: '2027-09-01', endDate: '2028-03-31' }) } }

export const Past: Story = { args: { season: season({ label: '2025/26', startDate: '2025-09-01', endDate: '2026-03-31' }) } }

export const Inactive: Story = { args: { season: season({ label: 'Trial 2026', active: false }) } }

// The figures show a dash while the summary loads or when it failed.
export const FiguresLoading: Story = { args: { season: season({}), summary: null } }

export const Empty: Story = { args: { season: season({}), summary: { seasonId: 's', leagueCount: 0, teamsEntered: 0, matchCount: 0 } } }
