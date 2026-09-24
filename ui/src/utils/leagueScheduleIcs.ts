import type { Match } from '../api/matchApi'
import type { Team } from '../api/teamApi'

// docs/specs/051-league-schedule-sharing.md — this codebase's first `.ics`/calendar generation
// (confirmed by exhaustive grep: no library dependency, no prior code). Hand-rolled `VCALENDAR`/
// `VEVENT` text, deliberately not a new dependency — matching both the legacy Cricket Legend app's
// own precedent of hand-building this rather than adding an ICS library, and this codebase's own
// teamSheetWhatsAppText.ts precedent of hand-building a well-understood, bounded text format
// rather than pulling one in.

interface ResolvedSide {
  name: string
  logoUrl: string | null
}

// Duplicates LeagueFixtures.tsx's own (unexported) resolveSide — deliberately, matching
// leagueSchedulePdf.ts's/leagueSchedulePoster.ts's own established precedent of small pure
// resolution helpers being independently duplicated per consumer rather than centralized. Only
// `.name` is read here — no logo to embed in a calendar event.
function resolveSide(
  teamId: string | null,
  teamName: string | null,
  logoUrl: string | null,
  teamsById: Map<string, Team>,
): ResolvedSide {
  if (teamId) {
    const team = teamsById.get(teamId)
    return { name: team?.name ?? 'Unknown team', logoUrl: team?.logoUrl ?? null }
  }
  return { name: teamName ?? 'TBC', logoUrl }
}

// RFC 5545 §3.3.11 text escaping — backslash first (so it doesn't double-escape the characters
// escaped after it), then semicolon/comma, then any line break to a literal "\n" token.
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// UTC `YYYYMMDDTHHMMSSZ` — deliberately not attempting VTIMEZONE handling, since a UTC-stamped
// event already renders correctly in the recipient's own local time in every mainstream calendar
// app (this spec's own stated reasoning).
function formatIcsDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

export interface LeagueScheduleIcsTeam {
  teamId: string
  teamName: string
}

// Builds a single per-team `.ics` calendar (one VEVENT per that team's fixtures in the given
// league+season) and returns a blob object URL — the caller wraps it in the same forced-download
// pattern as leagueSchedulePoster.ts (a `.ics` file has no browser-native renderer to open into).
// `team` is required, not optional — per this spec's own Non-goals, there is no whole-league
// calendar file, only ever a single team's own fixtures.
export function generateLeagueScheduleIcs(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  team: LeagueScheduleIcsTeam,
): string {
  const teamMatches = matches.filter((m) => m.homeTeamId === team.teamId || m.awayTeamId === team.teamId)
  const dtstamp = formatIcsDate(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cricket Legend//League Schedule//EN',
    'CALSCALE:GREGORIAN',
  ]

  teamMatches.forEach((match) => {
    const home = resolveSide(match.homeTeamId, match.homeTeamName, match.homeTeamLogoUrl, teamsById)
    const away = resolveSide(match.awayTeamId, match.awayTeamName, match.awayTeamLogoUrl, teamsById)
    const start = new Date(match.matchDate)
    // Fixed 3-hour event duration — this spec's own explicit decision (Match carries no format/
    // duration field to derive a more precise figure from; a generic club cricket fixture plus a
    // realistic pre/post-match window runs closer to 3 hours than a shorter default).
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)

    lines.push('BEGIN:VEVENT')
    // Stable across re-downloads, so re-importing the same schedule doesn't create duplicate
    // calendar entries in a calendar app that respects UID.
    lines.push(`UID:${match.id}@cricketlegend`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART:${formatIcsDate(start)}`)
    lines.push(`DTEND:${formatIcsDate(end)}`)
    lines.push(`SUMMARY:${escapeIcsText(`${home.name} vs ${away.name}`)}`)
    lines.push(`DESCRIPTION:${escapeIcsText(`${leagueName} — ${seasonLabel}`)}`)
    if (match.venue) {
      lines.push(`LOCATION:${escapeIcsText(match.venue)}`)
    }
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')

  // RFC 5545 requires CRLF line endings.
  const icsText = lines.join('\r\n')
  return URL.createObjectURL(new Blob([icsText], { type: 'text/calendar;charset=utf-8' }))
}
