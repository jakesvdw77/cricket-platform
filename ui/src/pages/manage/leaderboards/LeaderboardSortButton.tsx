import { ToolbarSortButton } from '../../../components/ToolbarCard'

export interface SortableColumn {
  code: string
  label: string
  longLabel?: string | null
  sortable: boolean
  // The column's natural direction (best first).
  direction: 'HIGHEST' | 'LOWEST'
}

export interface LeaderboardSortButtonProps {
  columns: SortableColumn[]
  sortCode: string
  // The direction in force (the requested one, else the column's natural one).
  effectiveDirection: 'HIGHEST' | 'LOWEST'
  // A column other than the current one was chosen (starts from its natural direction).
  onSelect: (code: string) => void
  // The current column's other direction was chosen.
  onReverse: () => void
}

const directionLabel = (direction: 'HIGHEST' | 'LOWEST') => (direction === 'HIGHEST' ? 'Highest First' : 'Lowest First')
const opposite = (direction: 'HIGHEST' | 'LOWEST') => (direction === 'HIGHEST' ? 'LOWEST' : 'HIGHEST')

// docs/specs/140: the ONE sort control of a leaderboard toolbar (replaces the Sort by select and the Reverse icon button). The menu lists
// every sortable column with its natural direction ("Runs, Highest First"); the current column also lists its other direction.
export function LeaderboardSortButton({ columns, sortCode, effectiveDirection, onSelect, onReverse }: LeaderboardSortButtonProps) {
  const sortable = columns.filter((column) => column.sortable)
  const nameOf = (column: SortableColumn) => column.longLabel ?? column.label
  const options = sortable.flatMap((column) => {
    const natural = { value: `${column.code}|${column.direction}`, label: `${nameOf(column)}, ${directionLabel(column.direction)}` }
    if (column.code !== sortCode) return [natural]
    const other = opposite(column.direction)
    const second = { value: `${column.code}|${other}`, label: `${nameOf(column)}, ${directionLabel(other)}` }
    return [natural, second]
  })
  if (options.length === 0) return null
  return (
    <ToolbarSortButton
      value={`${sortCode}|${effectiveDirection}`}
      options={options}
      onChange={(value) => {
        const [code, direction] = value.split('|')
        if (code !== sortCode) onSelect(code)
        else if (direction !== effectiveDirection) onReverse()
      }}
    />
  )
}
