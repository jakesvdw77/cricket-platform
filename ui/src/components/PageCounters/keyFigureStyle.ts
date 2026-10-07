// The Overview key-figure card style (docs/specs/079, 081). Shared by ManagerOverviewPage's key figures and
// PageCounters so the two cannot drift.
export const keyFigureCardSx = {
  bgcolor: 'background.paper',
  boxShadow: 2,
  p: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
}

export function keyFigureValueSx(warn: boolean) {
  return {
    fontSize: '1.6rem',
    fontWeight: 700,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
    color: warn ? 'warning.main' : 'text.primary',
  }
}
