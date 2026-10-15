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
