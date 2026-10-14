import type { FeaturedOverride } from '../api/matchResultApi'

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
