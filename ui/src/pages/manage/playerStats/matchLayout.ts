// docs/specs/115-player-match-list.md: layout constants of the Matches tab.

// The desktop table. Columns: Date, Opponent, Competition, Result, Runs, Balls, How out,
// Bowling, Fielding, Awards. The table is as wide as its panel and never narrower than the sum of its minimums (below that it scrolls).
export const MATCH_COLUMNS = 10
export const MATCH_GRID = '104px minmax(180px, 1.6fr) minmax(112px, 1fr) 112px 54px 54px 96px 150px 100px 56px'
export const MATCH_MIN_WIDTH = 1018

export const matchGridSx = {
  display: 'grid',
  gridTemplateColumns: MATCH_GRID,
  alignItems: 'center',
  width: '100%',
  minWidth: MATCH_MIN_WIDTH,
} as const

export const muted = { color: 'text.secondary' } as const

export const cardSx = {
  position: 'relative',
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  px: 1.75,
  py: 1.5,
  minHeight: 44,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.75,
  listStyle: 'none',
} as const


export const subSx = { fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.3, fontWeight: 400 } as const
