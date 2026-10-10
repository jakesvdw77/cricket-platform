import type { Season } from '../api/seasonApi'
import { localToday, seasonStatus } from './seasonStatus'
import type { SeasonStatus } from './seasonStatus'

// One quick filter per status; the same four as the counters.
export type SeasonFocus = SeasonStatus

export interface SeasonCounters {
  // Active seasons containing today. Two of them both count.
  current: number
  // What the Current counter shows: the label of the first current season in list order (the order
  // utils/defaultSeason.ts's pickDefaultSeasonId finds one in), with " +N" when N more also contain today; "None" when
  // there is none.
  currentLabel: string
  // Active seasons starting after today / ended before today.
  upcoming: number
  past: number
  // Inactive seasons, whether or not the list shows them.
  inactive: number
}

export const NO_CURRENT_SEASON = 'None'

// docs/specs/094-club-structure-and-seasons.md (B): the Seasons page's counters, computed client-side over the whole
// season list (bounded, so no endpoint), before search and the quick filter and independent of Show inactive: Inactive
// counts inactive seasons whether or not they are shown, the other three count active seasons only.
export function seasonCounters(seasons: Pick<Season, 'label' | 'startDate' | 'endDate' | 'active'>[], today: string = localToday()): SeasonCounters {
  const counters: SeasonCounters = { current: 0, currentLabel: NO_CURRENT_SEASON, upcoming: 0, past: 0, inactive: 0 }
  let firstCurrent: string | null = null
  seasons.forEach((season) => {
    const status = seasonStatus(season, today)
    if (status === 'current') {
      counters.current += 1
      firstCurrent ??= season.label
    } else {
      counters[status] += 1
    }
  })
  if (firstCurrent !== null) {
    counters.currentLabel = counters.current > 1 ? `${firstCurrent} +${counters.current - 1}` : firstCurrent
  }
  return counters
}

// Whether a season belongs to the list for a quick filter (the counters' cards). The four are mutually exclusive: a season
// has exactly one status, so it matches exactly one of them.
export function matchesSeasonFocus(season: Pick<Season, 'startDate' | 'endDate' | 'active'>, focus: SeasonFocus, today: string = localToday()): boolean {
  return seasonStatus(season, today) === focus
}
