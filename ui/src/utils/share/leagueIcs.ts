import { escapeIcsText, formatIcsDate } from '../leagueScheduleIcs'
import { leagueShareFileName } from './shareLeagueData'
import type { LeagueShareModel } from './shareLeagueData'

// docs/specs/122-league-sharing.md (Calendar): an .ics of the schedule fixtures and the key dates ticked. Reuses the
// escaping and UTC stamp of leagueScheduleIcs.ts (docs/specs/051), adding line folding and all-day events. Fixtures keep
// the 051 fixed three hour length and UTC stamp (no VTIMEZONE, so the recipient's calendar shows local time; the club's
// GMT+2 assumption is a known gap). Key dates are all-day events. Pure; no React.

export interface LeagueIcsEvent {
  uid: string
  summary: string
  description: string
  location: string | null
  // A fixture has a start and end; a key date is all-day (yyyy-mm-dd).
  start: Date | null
  end: Date | null
  allDayIso: string | null
  // What the screen lists.
  dateLabel: string
}

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// RFC 5545 section 3.1: lines are at most 75 octets; longer ones are folded with CRLF and a space. Folds never split a
// multi-byte character.
export function foldIcsLine(line: string, limit = 75): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= limit) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  let max = limit
  for (const char of Array.from(line)) {
    const bytes = encoder.encode(char).length
    if (size + bytes > max) {
      parts.push(current)
      current = ''
      size = 0
      max = limit - 1
    }
    current += char
    size += bytes
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const compactDate = (iso: string): string => iso.replace(/-/g, '')

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

export function leagueIcsEvents(model: LeagueShareModel): LeagueIcsEvent[] {
  const events: LeagueIcsEvent[] = []
  const describe = [model.league.name, model.season?.label].filter(Boolean).join(', ')
  if (model.contents.includes('SCHEDULE')) {
    for (const fixture of model.schedule) {
      const start = new Date(fixture.startsAt)
      if (Number.isNaN(start.getTime())) continue
      events.push({
        uid: `${fixture.matchId}@cricketlegend`,
        summary: `${fixture.home.name} vs ${fixture.away.name}`,
        description: describe,
        location: fixture.venue,
        start,
        end: new Date(start.getTime() + 3 * 60 * 60 * 1000),
        allDayIso: null,
        dateLabel: `${fixture.dateLabel}${fixture.timeLabel ? ` ${fixture.timeLabel}` : ''}`,
      })
    }
  }
  if (model.contents.includes('KEY_DATES')) {
    for (const date of model.keyDates) {
      events.push({
        uid: `${slug(model.title)}-${date.kind.toLowerCase()}-${date.dateIso}@cricketlegend`,
        summary: `${model.league.name}: ${date.label}`,
        description: describe,
        location: null,
        start: null,
        end: null,
        allDayIso: date.dateIso,
        dateLabel: date.dateLabel,
      })
    }
  }
  return events
}

export function generateLeagueIcsText(model: LeagueShareModel, now: Date = new Date()): string {
  const stamp = formatIcsDate(now)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cricket Legend//League Share//EN', 'CALSCALE:GREGORIAN']
  for (const event of leagueIcsEvents(model)) {
    lines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${stamp}`)
    if (event.allDayIso) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(event.allDayIso)}`, `DTEND;VALUE=DATE:${compactDate(addDays(event.allDayIso, 1))}`)
    } else if (event.start && event.end) {
      lines.push(`DTSTART:${formatIcsDate(event.start)}`, `DTEND:${formatIcsDate(event.end)}`)
    }
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`, `DESCRIPTION:${escapeIcsText(event.description)}`)
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  // RFC 5545 requires CRLF line endings.
  return lines.map((line) => foldIcsLine(line)).join('\r\n')
}

// The .ics as a file for download or the native share sheet. League, season and club names only in the file name.
export function generateLeagueIcsFile(model: LeagueShareModel, now?: Date): File {
  return new File([generateLeagueIcsText(model, now)], leagueShareFileName(model, 'ics'), {
    type: 'text/calendar;charset=utf-8',
  })
}
