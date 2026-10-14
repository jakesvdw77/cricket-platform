import type { DismissalType } from '../api/matchResultApi'
import { isWicket } from './dismissal'

// docs/specs/101-match-results-our-side-scorecard.md (Our batting, "Wicket-driven form"): the innings' wickets come from
// the Scores step. The grid starts with the first `wickets + 2` players as batted (the two at the crease at the end) and
// the rest as Did not bat. As the manager marks how each batter was out, once the number of dismissals equals the
// wickets the remaining undecided rows become Not out automatically; a cleared dismissal reverts them to undecided.
// Nothing is forced when the manager marks more dismissals than wickets. A Retired out row is a dismissal, a Retired
// not out row is not. Pure; the strips and meters are conveniences, the server's validation is authoritative.

export interface FillRow {
  // null = undecided (batted, how out not chosen yet).
  howOut: DismissalType | null
  // True when the fill (not the manager) set howOut; an edit by the manager clears it.
  auto?: boolean
}

// How many of `lineup` players are listed as having batted when the card is first built: wickets + 2, or everyone
// when the line-up is shorter (or the wickets are not known yet).
export function initialBattedCount(lineup: number, wickets: number | null): number {
  return wickets === null ? lineup : Math.min(lineup, Math.max(wickets, 0) + 2)
}

// The first how-out of each row of a freshly built card: undecided for those who batted, Did not bat for the rest.
export function initialRows(lineup: number, wickets: number | null): FillRow[] {
  const batted = initialBattedCount(lineup, wickets)
  return Array.from({ length: lineup }, (_, index) =>
    index < batted ? { howOut: null } : { howOut: 'DID_NOT_BAT' as const, auto: true },
  )
}

// The number of rows the manager marked as a wicket (Retired out counts, Retired not out does not).
export const dismissalCount = (rows: ReadonlyArray<Pick<FillRow, 'howOut'>>): number =>
  rows.filter((row) => isWicket(row.howOut)).length

// Re-applies the not-out rule after any edit. Rows the fill set earlier as Not out revert to undecided first, so a
// cleared dismissal takes the automatic Not outs back; then, if the dismissals now equal the wickets, every undecided
// row becomes an automatic Not out. Did not bat rows and everything the manager chose stay as they are.
export function applyWicketFill<T extends FillRow>(rows: T[], wickets: number | null): T[] {
  const reverted = rows.map((row) => (row.auto && row.howOut === 'NOT_OUT' ? { ...row, howOut: null, auto: false } : row))
  if (wickets === null || dismissalCount(reverted) !== wickets) return reverted
  return reverted.map((row) => (row.howOut === null ? { ...row, howOut: 'NOT_OUT' as const, auto: true } : row))
}

// The how-out a newly added row starts with (Add player, a picked player or a guest): appended after the existing rows, it
// is an undecided, editable row only while fewer than wickets + 2 batters are in play and the dismissals marked are still
// below the wickets; otherwise it is Did not bat (never an automatic Not out). Wickets not known: undecided, as before. A
// Did not bat row stays editable, and applyWicketFill never overwrites a row the manager set.
export function newRowFill(rows: ReadonlyArray<Pick<FillRow, 'howOut'>>, wickets: number | null): FillRow {
  if (wickets === null) return { howOut: null }
  const inPlay = rows.filter((row) => row.howOut !== 'DID_NOT_BAT').length
  const open = inPlay < initialBattedCount(Number.MAX_SAFE_INTEGER, wickets) && dismissalCount(rows) < wickets
  return open ? { howOut: null } : { howOut: 'DID_NOT_BAT', auto: true }
}

// The batted window follows the wickets even when they are entered after the rows were built (the innings card on Our
// batting is where they are now typed): rows beyond the first wickets + 2 that are still undecided and carry no figures
// become Did not bat (automatic), and automatic Did-not-bat rows that fall back inside the window (wickets raised, a row
// moved up) return to undecided. Rows the manager set, and rows with figures, are never touched. Unknown wickets: no change.
export function applyBattedWindow<T extends FillRow & { runs?: number | null; balls?: number | null; fours?: number | null; sixes?: number | null }>(
  rows: T[],
  wickets: number | null,
): T[] {
  if (wickets === null) return rows
  const window = initialBattedCount(Number.MAX_SAFE_INTEGER, wickets)
  return rows.map((row, index) => {
    const figures = row.runs != null || row.balls != null || row.fours != null || row.sixes != null
    if (index >= window && row.howOut === null && !figures) return { ...row, howOut: 'DID_NOT_BAT' as const, auto: true }
    if (index < window && row.howOut === 'DID_NOT_BAT' && row.auto) return { ...row, howOut: null, auto: false }
    return row
  })
}
