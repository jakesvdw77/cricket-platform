import type { ResultPlayer, ResultSide } from '../../../../api/matchResultApi'
import type { ImportNote, ImportNoteSuggestion } from '../../../../api/resultImportApi'
import type { GuessChipLevel } from '../../../../components/GuessChip'
import { playerRowKey } from '../../../../utils/scorecardPrefill'

// docs/specs/104-match-results-import-adaptors.md: pure helpers behind the Guess chips and the Teams banner. No business
// rules: the server decides what a guess is (`importMatch`) and what blocks publishing; this only counts and finds them
// so the wizard can lead the manager through them. Notes are what `resolve` said about each name (held for the session).

const norm = (text: string | null | undefined) => (text ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

// The note about a name, found by the spelling the file used.
export function noteFor(notes: ImportNote[], fileText: string | null | undefined): ImportNote | undefined {
  const wanted = norm(fileText)
  if (!wanted) return undefined
  return notes.find((note) => note.fileText && norm(note.fileText) === wanted)
}

// "by initials": the phrase after "Matched to <name>", from the note's code (NAME_<reason> as the server names it).
const REASON_PHRASES: Record<string, string> = {
  NAME_NORMALISED_EXACT: 'ignoring capitals, accents and spacing',
  NAME_NORMALISED: 'by the order or spelling of the words',
  NAME_INITIALS: 'by initials',
  NAME_SURNAME_INITIAL: 'by given name and the start of the surname',
  NAME_ABBREVIATED_SURNAME: 'by the abbreviated surname',
  NAME_SURNAME_PREFIX: 'by the start of the surname',
  NAME_ALIAS: 'from a name you confirmed before',
  NAME_SUGGESTED: 'as the closest player',
}

export function reasonPhrase(note: ImportNote | undefined): string | null {
  return note ? (REASON_PHRASES[note.code] ?? null) : null
}

export interface GuessInfo {
  // The row's player key (`playerRowKey`).
  key: string
  importedName: string
  level: GuessChipLevel
  matchedName: string | null
  reason: string | null
  // The best ranked suggestion for an unresolved name.
  closest: ImportNoteSuggestion | null
  suggestions: ImportNoteSuggestion[]
  // Only for a guess (an unresolved name has nothing to confirm).
  onConfirm?: () => void
  // Opens the picker.
  onChange: () => void
}

const isOurs = (player: ResultPlayer) => !player.opposition

// What an imported row needs checking for, or null when nothing: a flagged guess, or one of our guests the processor could
// not place (a note with level UNRESOLVED for the spelling the row kept).
export function guessLevelOf(player: ResultPlayer, notes: ImportNote[]): GuessChipLevel | null {
  if (!isOurs(player)) return null
  if (player.importMatch) return player.importMatch
  if (!player.playerProfileId && player.displayName) {
    const note = noteFor(notes, player.displayName)
    if (note && note.level === 'UNRESOLVED') return 'UNRESOLVED'
  }
  return null
}

export interface GuessSummary {
  // Rows linked by a rule that is a guess (a flagged row), all levels.
  guesses: number
  // Of those, the ones "Confirm all" may confirm: rule-based only, never a reserved AI level.
  ruleBased: number
  // Our guests the processor could not place.
  unresolved: number
}

export function summariseGuesses(players: ResultPlayer[], notes: ImportNote[]): GuessSummary {
  let guesses = 0
  let ruleBased = 0
  let unresolved = 0
  for (const player of players) {
    const level = guessLevelOf(player, notes)
    if (level === null) continue
    if (level === 'UNRESOLVED') unresolved += 1
    else {
      guesses += 1
      if (level === 'NORMALISED') ruleBased += 1
    }
  }
  return { guesses, ruleBased, unresolved }
}

export interface NextToCheck {
  key: string
  side: ResultSide
}

// The next row to check after `afterKey` (guesses first, then unresolved names, each in list order), wrapping round to the
// first; null when nothing is left to check.
export function nextToCheck(players: ResultPlayer[], notes: ImportNote[], afterKey?: string | null): NextToCheck | null {
  const todo = [
    ...players.filter((player) => {
      const level = guessLevelOf(player, notes)
      return level === 'NORMALISED' || level === 'AI_SUGGESTED'
    }),
    ...players.filter((player) => guessLevelOf(player, notes) === 'UNRESOLVED'),
  ]
  if (todo.length === 0) return null
  const at = afterKey ? todo.findIndex((player) => playerRowKey(player) === afterKey) : -1
  const next = todo[(at + 1) % todo.length]
  return { key: playerRowKey(next), side: next.side }
}

// "Confirm all": every rule-based guess (NORMALISED) loses its flag. A reserved AI level is never touched, it is confirmed
// one by one. Only clears flags, so the client still never sets one.
export function confirmRuleBased(players: ResultPlayer[]): ResultPlayer[] {
  return players.map((player) => (player.importMatch === 'NORMALISED' ? { ...player, importMatch: null } : player))
}

// The banner's sentence: "2 names were matched by a best guess and 1 could not be matched, so it is a guest."
export function bannerSentence(provider: string, summary: GuessSummary): string {
  const parts: string[] = []
  if (summary.guesses > 0) parts.push(`${summary.guesses} ${summary.guesses === 1 ? 'name was' : 'names were'} matched by a best guess`)
  if (summary.unresolved > 0) {
    parts.push(`${summary.unresolved} could not be matched, so ${summary.unresolved === 1 ? 'it is a guest' : 'they are guests'}`)
  }
  const middle = parts.length > 0 ? ` ${parts.join(' and ')}.` : ''
  const tail = summary.guesses > 0 ? ' A result cannot be published while a guess is unconfirmed.' : ''
  return `Imported from ${provider}.${middle}${tail}`
}
