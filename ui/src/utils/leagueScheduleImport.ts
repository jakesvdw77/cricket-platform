import type { QueryKey } from '@tanstack/react-query'
import type { ImportScope, ImportScopeMode, ImportTemplateScope } from '../api/importApi'
import { leagueTeamsQueryKey } from '../api/leagueTeamApi'

// docs/specs/098-league-schedule-import.md: the thin helpers of the first import consumer. The generic wizard knows no league;
// this builds the scope it is given, the keys a commit or delete must refresh, and the routes in and out.

export const LEAGUE_SCHEDULE_IMPORT_TYPE = 'LEAGUE_SCHEDULE'

export const DEFAULT_WINDOW_DAYS = 14
export const MIN_WINDOW_DAYS = 1
export const MAX_WINDOW_DAYS = 60

export interface LeagueScheduleScopeInput {
  leagueId: string
  seasonId: string
  scopeMode?: ImportScopeMode
  templateScope?: ImportTemplateScope
}

// The scope JSON of the preview, template and AI help calls: leagueId and seasonId are the consumer's params (windowDays is a decisions option, set on Check rows).
export function buildLeagueScheduleScope({ leagueId, seasonId, scopeMode = 'ALL', templateScope = 'OURS_AND_OTHERS' }: LeagueScheduleScopeInput): ImportScope {
  return { scopeMode, templateScope, params: { leagueId, seasonId } }
}

export function clampWindowDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WINDOW_DAYS
  return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, Math.round(value)))
}

// The batch scope key the handler stamps and the history filters by.
export function leagueScheduleScopeKey(leagueId: string, seasonId: string): string {
  return `league:${leagueId}|season:${seasonId}`
}

// Where the wizard lives; `from` says which Schedule the manager came from, so Back returns there.
export type LeagueScheduleOrigin = 'edit' | 'view'

export function leagueScheduleImportPath(leagueId: string, seasonId: string, from: LeagueScheduleOrigin = 'edit'): string {
  const params = new URLSearchParams({ seasonId })
  if (from === 'view') params.set('from', 'view')
  return `/manage/fixtures/leagues/${leagueId}/schedule/import?${params.toString()}`
}

export function leagueScheduleBackPath(leagueId: string, seasonId: string | null, from: LeagueScheduleOrigin = 'edit'): string {
  const season = seasonId ? `seasonId=${encodeURIComponent(seasonId)}` : ''
  // The edit page no longer has a Schedule tab (docs/specs/128): both origins return to the league page's Schedule.
  void from
  return `/manage/fixtures/leagues/${leagueId}/schedule${season ? `?${season}` : ''}`
}

// Refetched after a commit or a delete: the season's league teams, the league's matches, the club's matches and the leagues.
export function leagueScheduleInvalidateKeys(clubId: string, leagueId: string, seasonId: string): QueryKey[] {
  return [
    leagueTeamsQueryKey(clubId, leagueId, seasonId),
    ['managed-club', clubId, 'leagues', leagueId, 'matches', seasonId],
    ['managed-club', clubId, 'matches'],
    ['managed-club', clubId, 'leagues'],
  ]
}

// The disabled reason of the Import schedule control, or null when it may be used.
export function importScheduleDisabledReason({ hasSeason, leagueActive }: { hasSeason: boolean; leagueActive: boolean }): string | null {
  if (!hasSeason) return 'Create a season first'
  if (!leagueActive) return 'League is inactive'
  return null
}

const MAX_KEPT_CAPITALS = 5
const KEPT_VOWEL_RATIO = 0.2

// An all-capital token that reads as initials and stays as typed: it has a numeral or no vowel (CBC, U13, UTD), is one or two
// letters, or is up to five letters with almost no vowels (PHSOB, CBCOB). HIGH, VETS or HILTON are words and are title-cased.
function isInitialism(token: string): boolean {
  if (/\d/.test(token)) return true
  const letters = token.replace(/[^A-Za-z]/g, '')
  const vowels = letters.replace(/[^AEIOUaeiou]/g, '').length
  if (vowels === 0 || letters.length <= 2) return true
  return letters.length <= MAX_KEPT_CAPITALS && vowels / letters.length <= KEPT_VOWEL_RATIO
}

// A new team's suggested name (spec 098): case folded to title case, except initialisms (PHSOB, CBC, U13), which stay as typed.
// Numerals and mixed-case tokens are kept.
export function tidyTeamName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((token) => {
      if (!token) return token
      const upper = token === token.toUpperCase() && token !== token.toLowerCase()
      if (!upper) return token.charAt(0).toUpperCase() + token.slice(1)
      return isInitialism(token) ? token : token.charAt(0) + token.slice(1).toLowerCase()
    })
    .join(' ')
}

// The league page's Schedule (the route the edit page's pointer panel opens), keeping the selected season.
export function leagueSchedulePath(leagueId: string, seasonId: string | null): string {
  return `/manage/fixtures/leagues/${leagueId}/schedule${seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : ''}`
}

// The ONE builder of the Add match link of the league Schedule toolbar: the Match form (MatchFormPage) reads ?leagueId= and
// ?seasonId= to preselect both. docs/specs/126 Phase 2 replaces this button with Edit schedule, so nothing else builds it.
export function leagueAddMatchPath(leagueId: string, seasonId: string): string {
  return `/manage/fixtures/matches/new?leagueId=${leagueId}${seasonId ? `&seasonId=${seasonId}` : ''}`
}
