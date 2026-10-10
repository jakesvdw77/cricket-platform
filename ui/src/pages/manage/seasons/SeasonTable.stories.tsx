import type { Meta, StoryObj } from '@storybook/react-vite'
import { SeasonTable } from './SeasonTable'
import type { Season, SeasonSummary } from '../../../api/seasonApi'

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

const summaries: Record<string, SeasonSummary> = {
  a: { seasonId: 'a', leagueCount: 2, teamsEntered: 5, matchCount: 48 },
  b: { seasonId: 'b', leagueCount: 0, teamsEntered: 0, matchCount: 0 },
  c: { seasonId: 'c', leagueCount: 3, teamsEntered: 7, matchCount: 102 },
  d: { seasonId: 'd', leagueCount: 1, teamsEntered: 2, matchCount: 6 },
}

const meta: Meta<typeof SeasonTable> = {
  title: 'Pages/Manage/SeasonTable',
  component: SeasonTable,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof SeasonTable>

// docs/specs/094 (B): zebra rows, one of each status (Current, Upcoming, Past, Inactive).
export const Default: Story = {
  args: {
    today: '2026-10-10',
    summaries,
    seasons: [
      season({ id: 'a', label: '2026/27' }),
      season({ id: 'b', label: '2027/28', startDate: '2027-09-01', endDate: '2028-03-31' }),
      season({ id: 'c', label: '2025/26', startDate: '2025-09-01', endDate: '2026-03-31' }),
      season({ id: 'd', label: 'Trial 2026', startDate: '2026-01-01', endDate: '2026-06-30', active: false }),
    ],
  },
}

// The figures show a dash while the summary loads or when it failed.
export const FiguresLoading: Story = { args: { ...Default.args, summaries: null } }
