import type { Meta, StoryObj } from '@storybook/react-vite'
import { LeaderboardSortButton } from './LeaderboardSortButton'

const meta: Meta<typeof LeaderboardSortButton> = {
  title: 'Pages/Leaderboards/LeaderboardSortButton',
  component: LeaderboardSortButton,
  args: {
    columns: [
      { code: 'runs', label: 'R', longLabel: 'Runs scored', sortable: true, direction: 'HIGHEST' },
      { code: 'average', label: 'Avg', longLabel: 'Batting average', sortable: true, direction: 'HIGHEST' },
      { code: 'economy', label: 'Econ', longLabel: 'Economy', sortable: true, direction: 'LOWEST' },
    ],
    sortCode: 'runs',
    effectiveDirection: 'HIGHEST',
    onSelect: () => undefined,
    onReverse: () => undefined,
  },
}
export default meta

export const Default: StoryObj<typeof LeaderboardSortButton> = {}

// A lowest-first column in its natural direction.
export const LowestFirst: StoryObj<typeof LeaderboardSortButton> = { args: { sortCode: 'economy', effectiveDirection: 'LOWEST' } }
