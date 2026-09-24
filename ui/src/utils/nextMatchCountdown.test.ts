import { describe, expect, it } from 'vitest'
import type { Match } from '../api/matchApi'
import { resolveNextMatchCountdown } from './nextMatchCountdown'

// Local-time (no "Z" suffix) matchDate strings deliberately — both `now` and every match date
// below are constructed against the same local-time interpretation, so the "today"/"tomorrow"/
// multi-day calendar-day comparison is exercised consistently regardless of the machine running
// this suite's own timezone offset.
const now = new Date(2026, 2, 14, 10, 0, 0) // 14 Mar 2026, 10:00 local

function makeMatch(id: string, matchDate: string): Match {
  return {
    id,
    clubId: 'club-1',
    homeTeamId: 'team-home',
    homeTeamName: null,
    awayTeamId: 'team-away',
    awayTeamName: null,
    leagueId: 'league-1',
    seasonId: 'season-1',
    matchDate,
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

const laterToday = makeMatch('match-today', '2026-03-14T22:00:00')
const justAfterMidnightTomorrow = makeMatch('match-tomorrow', '2026-03-15T00:10:00')
const fiveDaysOut = makeMatch('match-multi-day', '2026-03-19T09:00:00')
const earlierToday = makeMatch('match-past-today', '2026-03-14T08:00:00')
const lastWeek = makeMatch('match-past-week', '2026-03-10T10:00:00')

describe('resolveNextMatchCountdown', () => {
  it('selects the earliest future match from an unsorted, mixed past/future list', () => {
    const result = resolveNextMatchCountdown(
      [fiveDaysOut, earlierToday, laterToday, lastWeek, justAfterMidnightTomorrow],
      now,
    )

    expect(result?.match.id).toBe('match-today')
    expect(result?.label).toBe('today')
  })

  it('returns null when no future match exists', () => {
    const result = resolveNextMatchCountdown([earlierToday, lastWeek], now)

    expect(result).toBeNull()
  })

  it('labels a match later the same calendar day as "today"', () => {
    const result = resolveNextMatchCountdown([laterToday], now)

    expect(result).toEqual({ match: laterToday, label: 'today' })
  })

  it('labels a match just after midnight the next calendar day as "tomorrow"', () => {
    const result = resolveNextMatchCountdown([justAfterMidnightTomorrow], now)

    expect(result).toEqual({ match: justAfterMidnightTomorrow, label: 'tomorrow' })
  })

  it('labels a match several calendar days out as "days", with the correct whole-day count', () => {
    const result = resolveNextMatchCountdown([fiveDaysOut], now)

    expect(result).toEqual({ match: fiveDaysOut, label: 'days', value: 5 })
  })

  it('excludes a match earlier the same calendar day — strictly-future, not same-day-inclusive', () => {
    const result = resolveNextMatchCountdown([earlierToday], now)

    expect(result).toBeNull()
  })
})
