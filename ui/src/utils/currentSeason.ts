import type { Season } from '../api/seasonApi'

type SeasonDates = Pick<Season, 'id' | 'startDate' | 'endDate' | 'active'>

// Today as yyyy-MM-dd in the browser's local time (season dates are plain dates, compared as text).
function localDay(today: Date): string {
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

// The season a new record should start in: among ACTIVE seasons, the one containing today (the one that started latest
// when several do), else the one that starts soonest after today, else the most recently ended one. null when there
// are no active seasons. (Not pickDefaultSeasonId, which ignores the active flag and falls back to creation order.)
export function currentSeasonId(seasons: SeasonDates[], today: Date = new Date()): string | null {
  const day = localDay(today)
  const active = seasons.filter((season) => season.active)

  const containing = active
    .filter((season) => season.startDate <= day && day <= season.endDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  if (containing.length > 0) {
    return containing[0].id
  }

  const upcoming = active.filter((season) => season.startDate > day).sort((a, b) => a.startDate.localeCompare(b.startDate))
  if (upcoming.length > 0) {
    return upcoming[0].id
  }

  const ended = active.filter((season) => season.endDate < day).sort((a, b) => b.endDate.localeCompare(a.endDate))
  return ended.length > 0 ? ended[0].id : null
}
