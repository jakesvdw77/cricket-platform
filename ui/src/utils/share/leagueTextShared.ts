import { LEAGUE_CONTENT_LABELS } from './leagueShareFormats'
import type { LeagueContent } from './leagueShareFormats'
import type { LeagueShareModel, LeagueShareResult } from './shareLeagueData'

// docs/specs/122-league-sharing.md (Text content): the section lines the WhatsApp and Facebook league texts share. Pure.
// Every name comes from the LeagueShareModel, so it is already in the shared name form. Players are never called
// "children": the age range is written as a range only.

export interface LeagueTextSection {
  content: LeagueContent
  heading: string
  lines: string[]
}

export interface LeagueTextOptions {
  // Results as the result line (true) or as scores only (false).
  resultLine: boolean
  // Longest list a section shows; undefined shows all. The remainder is counted ("and 4 more").
  limit?: number
}

const more = (total: number, shown: number): string[] => (total > shown ? [`and ${total - shown} more`] : [])

function resultText(row: LeagueShareResult, asLine: boolean): string {
  const scores = [row.homeScore && `${row.home.name} ${row.homeScore}`, row.awayScore && `${row.away.name} ${row.awayScore}`].filter(Boolean)
  if (asLine || scores.length < 2) {
    return `${row.home.name} v ${row.away.name}: ${row.resultLine}`
  }
  return `${row.home.name} ${row.homeScore} v ${row.away.name} ${row.awayScore}`
}

export function leagueTextSections(model: LeagueShareModel, options: LeagueTextOptions): LeagueTextSection[] {
  const cap = <T,>(rows: T[]): T[] => (options.limit === undefined ? rows : rows.slice(0, options.limit))
  const sections: LeagueTextSection[] = []
  for (const content of model.contents) {
    const lines: string[] = []
    if (content === 'DETAILS') {
      const { league } = model
      if (league.formatLabel) lines.push(`Format: ${league.formatLabel}`)
      if (league.ageLabel) lines.push(`Ages: ${league.ageLabel}`)
      if (league.matchCount > 0) lines.push(`Matches: ${league.matchCount}`)
      if (league.website) lines.push(`Website: ${league.website}`)
      if (league.phone) lines.push(`Phone: ${league.phone}`)
      if (league.email) lines.push(`Email: ${league.email}`)
      for (const contact of league.contacts) {
        const reach = [contact.phone, contact.email].filter(Boolean).join(', ')
        lines.push(`${contact.role}: ${contact.name}${reach ? ` (${reach})` : ''}`)
      }
    } else if (content === 'CONDITIONS') {
      const sections = options.limit === undefined ? model.conditions : model.conditions.slice(0, 1)
      for (const section of sections) {
        lines.push(`${section.heading}: ${section.rows.map((row) => `${row.label} ${row.value}`).join(', ')}`)
      }
    } else if (content === 'TEAMS') {
      const rows = cap(model.teams)
      lines.push(...rows.map((team) => team.name), ...more(model.teams.length, rows.length))
    } else if (content === 'SCHEDULE') {
      const rows = cap(model.schedule)
      lines.push(
        ...rows.map((fixture) => {
          const where = fixture.venue ? `, ${fixture.venue}` : ''
          return `${fixture.dateLabel}${fixture.timeLabel ? ` ${fixture.timeLabel}` : ''}: ${fixture.home.name} v ${fixture.away.name}${where}`
        }),
        ...more(model.schedule.length, rows.length),
      )
    } else if (content === 'RESULTS') {
      const rows = cap(model.results)
      lines.push(...rows.map((row) => resultText(row, options.resultLine)), ...more(model.results.length, rows.length))
    } else if (content === 'KEY_DATES') {
      lines.push(...model.keyDates.map((date) => `${date.label}: ${date.dateLabel}`))
    }
    if (lines.length > 0) sections.push({ content, heading: LEAGUE_CONTENT_LABELS[content], lines })
  }
  return sections
}

export const leagueTitleLine = (model: LeagueShareModel): string => model.title
