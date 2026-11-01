// docs/specs/131-match-sharing.md (Fun facts): rule-built facts, one table of facts and thresholds, each a pure function that
// returns text and its basis or null when there is not enough data. Never AI, never a fact without data. Only team names
// appear in these facts (milestone facts about people need a statistics read and are not offered yet).

export const FORM_WINDOW = 5
// A form fact needs at least this many completed matches in its window.
export const MIN_FORM_MATCHES = 3
// Head to head and last meeting need at least this many prior meetings.
export const MIN_MEETINGS = 3
export const MAX_PRETICKED_FACTS = 5

export interface FactResultRow {
  // yyyy-mm-dd of the match
  dateIso: string
  // Which side of that match the team in question was.
  teamSide: 'HOME' | 'AWAY'
  outcomeType: string | null
  winningSide: 'HOME' | 'AWAY' | null
}

export interface FunFactsInput {
  ourName: string
  oppositionName: string
  // Our published results, newest first.
  ours: FactResultRow[]
  // The opposition's published results, newest first; empty unless it is a platform team the caller could read.
  opposition: FactResultRow[]
  // Our published results against this opposition, newest first.
  headToHead: FactResultRow[]
}

export type FunFactId = 'OUR_FORM' | 'OPPOSITION_FORM' | 'HEAD_TO_HEAD' | 'LAST_MEETING'

export interface FunFact {
  id: FunFactId
  label: string
  text: string
  // "Form, last 5 published results"
  basis: string
}

export const FUN_FACT_ORDER: FunFactId[] = ['OUR_FORM', 'OPPOSITION_FORM', 'HEAD_TO_HEAD', 'LAST_MEETING']

type Verdict = 'W' | 'L' | 'T'

// A completed result as the team in question saw it; null when nobody won and it was not a tie (no result, abandoned...).
export function verdictOf(row: FactResultRow): Verdict | null {
  if (row.outcomeType === 'TIE') return 'T'
  if (row.outcomeType === 'WON' && row.winningSide) return row.winningSide === row.teamSide ? 'W' : 'L'
  return null
}

const decided = (rows: FactResultRow[]) => rows.filter((row) => verdictOf(row) !== null)

function formFact(id: FunFactId, name: string, rows: FactResultRow[], basis: string): FunFact | null {
  const window = decided(rows).slice(0, FORM_WINDOW)
  if (window.length < MIN_FORM_MATCHES) return null
  const won = window.filter((row) => verdictOf(row) === 'W').length
  return {
    id,
    label: id === 'OUR_FORM' ? 'Our form' : 'Opposition form',
    text: `${name} have won ${won} of their last ${window.length}`,
    basis: `${basis}, last ${window.length} published results`,
  }
}

const dayLabel = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

function headToHeadFact(input: FunFactsInput): FunFact | null {
  const meetings = decided(input.headToHead)
  if (meetings.length < MIN_MEETINGS) return null
  const ours = meetings.filter((row) => verdictOf(row) === 'W').length
  const theirs = meetings.filter((row) => verdictOf(row) === 'L').length
  const text =
    ours === theirs
      ? `Head to head: ${ours} ${ours === 1 ? 'win' : 'wins'} each from ${meetings.length}`
      : ours > theirs
        ? `${input.ourName} lead the head to head ${ours} to ${theirs} from ${meetings.length}`
        : `${input.oppositionName} lead the head to head ${theirs} to ${ours} from ${meetings.length}`
  return { id: 'HEAD_TO_HEAD', label: 'Head to head', text, basis: `Head to head, ${meetings.length} meetings` }
}

function lastMeetingFact(input: FunFactsInput): FunFact | null {
  const meetings = decided(input.headToHead)
  if (meetings.length < MIN_MEETINGS) return null
  const last = meetings[0]
  const verdict = verdictOf(last)
  const result = verdict === 'T' ? 'The last meeting was a tie' : verdict === 'W' ? `${input.ourName} won the last meeting` : `${input.oppositionName} won the last meeting`
  return { id: 'LAST_MEETING', label: 'Last meeting', text: `${result}, ${dayLabel(last.dateIso)}`, basis: `Last of ${meetings.length} meetings` }
}

// Every fact the data supports, in the standard order.
export function buildFunFacts(input: FunFactsInput): FunFact[] {
  return [
    formFact('OUR_FORM', input.ourName, input.ours, 'Form'),
    formFact('OPPOSITION_FORM', input.oppositionName, input.opposition, 'Form, platform team'),
    headToHeadFact(input),
    lastMeetingFact(input),
  ].filter((fact): fact is FunFact => fact !== null)
}
