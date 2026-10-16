import type { MatchPayload } from '../../../../api/matchApi'
import type { ImportCounts, ImportedResult, ImportExactness } from '../../../../api/resultImportApi'
import type { ResultValidation } from '../../../../api/matchResultApi'

// docs/specs/104-match-results-import-adaptors.md: the plain-English lines the Match and Teams steps show about the document
// and about what `resolve` did. Pure, no rules: they only word what the server returned.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "11 Oct 2026, 13:00" from the file's yyyy-MM-dd and HH:mm (read as written, never through a time zone); null with no date.
export function fileDateTime(document: ImportedResult): string | null {
  const date = document.match?.date
  const parts = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null
  if (!parts) return null
  const day = `${Number(parts[3])} ${MONTHS[Number(parts[2]) - 1] ?? ''} ${parts[1]}`.replace('  ', ' ')
  const time = document.match?.startTime
  return time ? `${day}, ${time}` : day
}

// What the Add match dialog opens with, from the file. Conservative: the two team names go in as free text (the file does not
// say which side is the club's, so the manager picks), the venue as text, the date and start time as written (no start time
// reads as 00:00 for the manager to correct). Nothing is set that the file does not say.
export function matchPrefill(document: ImportedResult): Partial<MatchPayload> {
  const values: Partial<MatchPayload> = {}
  const date = document.match?.date
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const time = document.match?.startTime
    const local = new Date(`${date}T${time && /^\d{2}:\d{2}$/.test(time) ? time : '00:00'}`)
    if (!Number.isNaN(local.getTime())) values.matchDate = local.toISOString()
  }
  const venue = document.match?.venue?.trim()
  if (venue) values.venue = venue
  const [home, away] = document.teams ?? []
  if (document.teams?.length === 2 && home.name.trim() && away.name.trim()) {
    values.homeTeamName = home.name.trim()
    values.awayTeamName = away.name.trim()
  }
  return values
}

export function fileTeamsLine(document: ImportedResult): string | null {
  const names = (document.teams ?? []).map((team) => team.name)
  return names.length === 2 ? `${names[0]} v ${names[1]}` : null
}

export function fileSourceLine(document: ImportedResult): string | null {
  const provider = document.source?.provider
  if (!provider) return null
  return document.source?.externalMatchId ? `${provider}, ${document.source.externalMatchId}` : provider
}

const OUTCOME_WORDS: Record<string, string> = {
  TIE: 'Match tied',
  DRAW: 'Match drawn',
  NO_RESULT: 'No result',
  ABANDONED: 'Match abandoned',
  FORFEIT: 'Forfeit',
}

// "Pretoria A won by 8 wickets", or null when the file has no result.
export function fileResultLine(document: ImportedResult): string | null {
  const result = document.result
  if (!result?.outcome) return null
  if (result.outcome !== 'WON') return OUTCOME_WORDS[result.outcome] ?? null
  const winner = (document.teams ?? []).find((team) => team.key === result.winner)?.name
  if (!winner) return null
  const margin = result.margin
  if (!margin || margin.value === undefined || !margin.type) return `${winner} won`
  const unit = margin.type === 'RUNS' ? (margin.value === 1 ? 'run' : 'runs') : margin.value === 1 ? 'wicket' : 'wickets'
  return `${winner} won by ${margin.value} ${unit}`
}

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`

// "9 names matched exactly, 2 are guesses to check, 1 is a guest."
export function resolvedSentence(counts: ImportCounts): string {
  const guesses = counts.normalised + counts.aiSuggested
  const parts: string[] = []
  if (counts.exact > 0) parts.push(`${count(counts.exact, 'name', 'names')} matched exactly`)
  if (guesses > 0) parts.push(`${guesses} ${guesses === 1 ? 'is a guess' : 'are guesses'} to check`)
  if (counts.unresolved > 0) parts.push(`${counts.unresolved} ${counts.unresolved === 1 ? 'is a guest' : 'are guests'}`)
  return `Draft created. ${parts.length > 0 ? `${parts.join(', ')}.` : 'There were no names to match.'}`
}

// "Checks: 0 errors, 2 warnings."
export function checksSentence(validation: Pick<ResultValidation, 'errors' | 'warnings'> | null | undefined): string {
  const errors = validation?.errors.length ?? 0
  const warnings = validation?.warnings.length ?? 0
  return `Checks: ${count(errors, 'error', 'errors')}, ${count(warnings, 'warning', 'warnings')}.`
}

// The exactness of a team mapping in words, for its chip.
export const EXACTNESS_WORDS: Record<ImportExactness, string> = {
  EXACT: 'Exact',
  NORMALISED: 'Normalised',
  AI_SUGGESTED: 'Suggested',
  UNRESOLVED: 'Unresolved',
}

const DAY_PARTS = /^(\d{4})-(\d{2})-(\d{2})$/

// Whole calendar days as a number, so a daylight-saving change never turns a day into 23 or 25 hours.
const dayNumber = (year: number, month: number, day: number) => Math.round(Date.UTC(year, month, day) / 86_400_000)

export interface DateMismatch {
  fileDay: string
  matchDay: string
}

// The match's local calendar day against the file's date (read as written). Returns both days in words when they are MORE than
// one calendar day apart, else null (also null with no or unreadable file date). A convenience only: the server does not check.
export function dateMismatch(document: ImportedResult, matchDate: string): DateMismatch | null {
  const parts = DAY_PARTS.exec(document.match?.date ?? '')
  const match = new Date(matchDate)
  if (!parts || Number.isNaN(match.getTime())) return null
  const [year, month, day] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])]
  const apart = Math.abs(dayNumber(year, month, day) - dayNumber(match.getFullYear(), match.getMonth(), match.getDate()))
  if (apart <= 1) return null
  return { fileDay: `${day} ${MONTHS[month] ?? ''} ${year}`, matchDay: `${match.getDate()} ${MONTHS[match.getMonth()]} ${match.getFullYear()}` }
}

// docs/specs/104: the warning under a created draft when most of a team's names were not found in the squad, the strongest sign that
// the wrong team (or the wrong match) was picked. Opposition names are never counted as unresolved, so the unresolved count is
// our side's guests. `teamName` is the club's team on the match when exactly one side is, otherwise "your team".
export const MANY_GUESTS = 5

export function squadMismatchSentence(counts: ImportCounts, teamName: string | null): string | null {
  if (counts.unresolved < MANY_GUESTS) return null
  return `${counts.unresolved} names were not found in ${teamName ? `${teamName}'s` : "your team's"} squad. If that is not the team that played, go back and choose the right match or team before you review.`
}
