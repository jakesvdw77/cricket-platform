import type { ResultIssue, ResultValidation, ResultWizardStep } from '../../../../api/matchResultApi'

// docs/specs/101-match-results-our-side-scorecard.md: the Review step's Checks come from the typed `issues` of the
// validation (code, step, side, severity). The wizard step an issue is fixed on, by the ids of the page's step list.
const STEP_IDS: Record<ResultWizardStep, string> = {
  RESULT: 'outcome',
  TOSS: 'toss',
  SCORES: 'scores',
  TEAMS: 'teams',
  BATTING: 'batting',
  BOWLING: 'bowling',
  AWARDS: 'awards',
}

// Issues about who played (the lineup, guests and duplicates, squads) are fixed on Teams whichever step the server filed them under.
const TEAM_CODES = new Set([
  'LINEUP_TOO_LARGE',
  'PLAYER_NOT_IN_SQUAD',
  'GUEST_NAME_MATCHES_PLAYER',
  'PLAYER_ON_BOTH_SIDES',
  'GUEST_ON_BOTH_SIDES',
  'SCORECARD_PLAYER_DUPLICATE',
  'SCORECARD_PLAYER_IDENTITY_MISSING',
  'SCORECARD_PLAYER_KEY_MISSING',
  'SCORECARD_PLAYER_KEY_DUPLICATE',
  'SCORECARD_PLAYER_SIDE_MISSING',
  // docs/specs/104: an imported guess is confirmed or changed on Teams, on the side the issue names.
  'IMPORTED_NAME_UNCONFIRMED',
])

export const stepIdForIssue = (step: ResultWizardStep | null | undefined, code?: string | null): string | null =>
  code && TEAM_CODES.has(code) ? 'teams' : step ? STEP_IDS[step] : null

// The scorecard's own steps: their issues are never matched by wording (that is for the older, string-only checks).
export const isScorecardStep = (step: ResultWizardStep | null | undefined): boolean =>
  step === 'TEAMS' || step === 'BATTING' || step === 'BOWLING' || step === 'AWARDS'

// The validation as typed issues. A response without `issues` (a server that predates them) is read from its plain error
// and warning lines, which carry no code, step or side.
export function issuesOf(validation: Pick<ResultValidation, 'errors' | 'warnings'> & { issues?: ResultIssue[] | null }): ResultIssue[] {
  if (validation.issues && validation.issues.length > 0) return validation.issues
  return [
    ...validation.errors.map((message): ResultIssue => ({ code: '', step: null, side: null, severity: 'ERROR', message })),
    ...validation.warnings.map((message): ResultIssue => ({ code: '', step: null, side: null, severity: 'WARNING', message })),
  ]
}
