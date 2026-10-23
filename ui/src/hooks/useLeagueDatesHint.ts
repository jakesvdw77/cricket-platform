import { useQuery } from '@tanstack/react-query'
import { getLeagueSeasonDates, leagueSeasonDatesKey } from '../api/leagueSeasonDatesApi'
import type { LeagueSeasonDates } from '../api/leagueSeasonDatesApi'
import { formatReferenceDate } from '../utils/ageCutoff'

export interface LeagueDatesHint {
  // The league's dates in the season, or null when none are set, the scope is incomplete or the lookup failed.
  range: LeagueSeasonDates | null
  // The entered day (yyyy-MM-dd, or a date-time starting with it) is outside the range; a blank day is not "outside".
  outside: boolean
  // "This league runs from 1 Sep 2026 to 31 Jul 2027." (the server's wording), only while outside.
  message: string | undefined
}

// docs/specs/111: the league's dates in the chosen season, looked up once both league and season are chosen. No dates, or
// a failed lookup, leaves the date unrestricted (the server still checks). Shared by the match form and the date dialog.
export function useLeagueDatesHint(
  clubId: string,
  leagueId: string | null | undefined,
  seasonId: string | null | undefined,
  day: string,
  enabled = true,
): LeagueDatesHint {
  const hasScope = Boolean(leagueId && seasonId)
  const query = useQuery({
    queryKey: leagueSeasonDatesKey(clubId, leagueId ?? '', seasonId ?? ''),
    queryFn: () => getLeagueSeasonDates(clubId, leagueId ?? '', seasonId ?? ''),
    enabled: enabled && hasScope,
    retry: false,
  })
  const range = hasScope ? (query.data ?? null) : null
  const date = day.slice(0, 10)
  const outside = Boolean(range && date && (date < range.startDate || date > range.endDate))
  const message = outside && range ? `This league runs from ${formatReferenceDate(range.startDate)} to ${formatReferenceDate(range.endDate)}.` : undefined
  return { range, outside, message }
}
