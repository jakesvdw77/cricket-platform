import type { Season } from '../api/seasonApi'

// Shared "which season should a season-scoped picker default to" rule — docs/specs/
// 029-league-management.md's TeamFormPage Squad tab requirement ("defaulting to whichever
// season's date range contains today, else the most recently created season"), reused by
// LeagueFormPage's Affiliations tab for the same reasonable default rather than always landing on
// an arbitrary first-in-list season.
export function pickDefaultSeasonId(seasons: Season[]): string | undefined {
  if (seasons.length === 0) {
    return undefined
  }

  const today = new Date().toISOString().slice(0, 10)
  const current = seasons.find((season) => season.startDate <= today && season.endDate >= today)
  if (current) {
    return current.id
  }

  const mostRecent = [...seasons].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return mostRecent.id
}
