import type { DismissalType } from '../api/matchResultApi'
import { isWicket } from './dismissal'

// docs/specs/101-match-results-our-side-scorecard.md (Batting, "Wicket-driven form"), as changed on 2026-10-15: a batting row
// never shows a blank How out. A row with no how out and no figures IS Did not bat (automatic: italic and grey in the grid),
// whether it was built from the selection, typed in, or reloaded. As soon as the manager picks a How out or types a figure
// the row is a batted row (the automatic flag clears). Not-out assignment: when the dismissals marked equal the innings'
// wickets (typed or calculated), the next two rows after the last dismissed batter that have no how out become Not out
// (automatic) and any later ones stay Did not bat. With fewer (or more) dismissals than wickets, or wickets unknown, nothing
// is made Not out; the manager marks the not-out batters. A Retired out row is a dismissal, a Retired not out row is not.
// Pure; the meters are conveniences, the server's validation is authoritative.

export interface FillRow {
  // null = a batted row whose how out is not chosen yet (only possible once it has figures).
  howOut: DismissalType | null
  // True when the fill (not the manager) set howOut; an edit by the manager clears it.
  auto?: boolean
}

type FigureRow = FillRow & { runs?: number | null; balls?: number | null; fours?: number | null; sixes?: number | null }

const hasFigures = (row: FigureRow): boolean => row.runs != null || row.balls != null || row.fours != null || row.sixes != null

// The first rows of a freshly built card: everyone is Did not bat until the manager says otherwise.
export function initialRows(lineup: number, _wickets?: number | null): FillRow[] {
  return Array.from({ length: lineup }, () => ({ howOut: 'DID_NOT_BAT' as const, auto: true }))
}

// The number of rows the manager marked as a wicket (Retired out counts, Retired not out does not).
export const dismissalCount = (rows: ReadonlyArray<Pick<FillRow, 'howOut'>>): number =>
  rows.filter((row) => isWicket(row.howOut)).length

// Re-applies the rules after any edit. Automatic Not out / Did not bat rows are first released (so a figure typed on a Did not
// bat row flips it to a batted row, and a cleared dismissal takes the automatic Not outs back); then, if the dismissals equal
// the wickets, the next two undecided rows after the last dismissed batter become automatic Not outs; every other undecided
// row without figures becomes an automatic Did not bat. Rows the manager set are never touched; an undecided row with figures
// stays a batted row with no how out.
export function applyWicketFill<T extends FigureRow>(rows: T[], wickets: number | null): T[] {
  const released = rows.map((row) => (row.auto && (row.howOut === 'NOT_OUT' || row.howOut === 'DID_NOT_BAT') ? { ...row, howOut: null, auto: false } : row))
  const lastOut = released.reduce((last, row, index) => (isWicket(row.howOut) ? index : last), -1)
  const settled = wickets !== null && dismissalCount(released) === wickets
  let given = 0
  return released.map((row, index) => {
    if (row.howOut !== null) return row
    // A batted row with figures and no how out yet is neither a wicket nor Not out until the manager chooses.
    if (hasFigures(row)) return row
    if (settled && index > lastOut && given < 2) {
      given += 1
      return { ...row, howOut: 'NOT_OUT' as const, auto: true }
    }
    return { ...row, howOut: 'DID_NOT_BAT' as const, auto: true }
  })
}

// The how-out a newly added row starts with (Add player, a picked player, a typed name): Did not bat, like every row without
// figures.
export function newRowFill(_rows?: ReadonlyArray<Pick<FillRow, 'howOut'>>, _wickets?: number | null): FillRow {
  return { howOut: 'DID_NOT_BAT', auto: true }
}
