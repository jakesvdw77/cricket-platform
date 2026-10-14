import type { BattingEntry, BowlingEntry, FeaturedOverride, FieldingEntry } from '../api/matchResultApi'

// docs/specs/101-match-results-our-side-scorecard.md (Standout icon toggle): the star on a scorecard row. The server
// suggests standouts (`suggested`) and stores the manager's edit (`featuredOverride`) apart from the computed value;
// the effective flag is the override when there is one, else the suggestion. These two helpers only mirror that for
// the immediate tap feedback; the server's `featured` is authoritative and the rules themselves are never recomputed
// here.

export const effectiveFeatured = (suggested: boolean | null | undefined, override: FeaturedOverride | null | undefined): boolean =>
  override === 'FEATURE' ? true : override === 'HIDE' ? false : Boolean(suggested)

// The override a tap on the star writes: HIDE on a suggested row, FEATURE on any other, and null (follow the
// suggestion) when the tap would restore what the rules suggest.
export function toggledOverride(
  suggested: boolean | null | undefined,
  override: FeaturedOverride | null | undefined,
): FeaturedOverride | null {
  const featured = effectiveFeatured(suggested, override)
  if (featured) return suggested ? 'HIDE' : null
  return suggested ? null : 'FEATURE'
}

// docs/specs/101 (decision 2026-10-14): the obvious cases that never get a star. A batter who did not bat or scored no
// runs, a bowler who bowled no balls and a fielder with no credit cannot be featured; the server never suggests them
// either. One function per table, used by the entry steps, the Awards standouts and the result page. (Thresholds stay a
// later concept.)
export const canFeatureBatter = (entry: Pick<BattingEntry, 'howOut' | 'runs'>): boolean =>
  entry.howOut !== 'DID_NOT_BAT' && (entry.runs ?? 0) > 0

export const canFeatureBowler = (entry: Pick<BowlingEntry, 'balls'>): boolean => (entry.balls ?? 0) > 0

export const canFeatureFielder = (entry: Pick<FieldingEntry, 'catches' | 'stumpings' | 'runOuts'>): boolean =>
  (entry.catches ?? 0) + (entry.stumpings ?? 0) + (entry.runOuts ?? 0) > 0
