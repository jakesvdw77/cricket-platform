import type { Match } from '../api/matchApi'

export interface NextMatchCountdown {
  match: Match
  label: 'today' | 'tomorrow' | 'days'
  // Whole days until the match — present only when label === 'days'. The 'today'/'tomorrow' cases
  // are rendered as plain-language chips by NextMatchCountdown, never as "0 days"/"1 day".
  value?: number
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export interface CountdownLabel {
  label: 'today' | 'tomorrow' | 'days'
  value?: number
}

// docs/specs/071-league-card-redesign.md: the day-label rule alone, so the league card's "in N days"
// badge and the Schedule countdown never state it differently. Local calendar days, midnight to
// midnight: <= 0 is today, 1 is tomorrow, anything else a day count.
export function resolveCountdownLabel(matchDate: string, now: Date): CountdownLabel {
  const matchDay = startOfDay(new Date(matchDate))
  const today = startOfDay(now)
  const dayDiff = Math.round((matchDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

  if (dayDiff <= 0) {
    return { label: 'today' }
  }
  if (dayDiff === 1) {
    return { label: 'tomorrow' }
  }
  return { label: 'days', value: dayDiff }
}

// docs/specs/051-league-schedule-sharing.md — a pure function, injectable `now` for testability.
// Finds the earliest match with a strictly future matchDate; returns null when none exists. The
// day-count compares each date's own local calendar day (midnight-to-midnight), not raw elapsed
// hours, so a match later today is still "Today" and one just after midnight tomorrow is still
// "Tomorrow" — matching how a person actually reads a countdown rather than a raw hour count.
export function resolveNextMatchCountdown(matches: Match[], now: Date): NextMatchCountdown | null {
  const future = matches
    .filter((match) => new Date(match.matchDate).getTime() > now.getTime())
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))

  const match = future[0]
  if (!match) {
    return null
  }

  return { match, ...resolveCountdownLabel(match.matchDate, now) }
}
