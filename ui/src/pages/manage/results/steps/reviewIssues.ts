import type { ResultIssue, ResultValidation, ResultWizardStep } from '../../../../api/matchResultApi'

// docs/specs/101-match-results-our-side-scorecard.md: the Review step's Checks come from the typed `issues` of the
// validation (code, step, side, severity). The wizard step an issue is fixed on, by the ids of the page's step list.
const STEP_IDS: Record<ResultWizardStep, string> = {
  RESULT: 'outcome',
  TOSS: 'toss',
  SCORES: 'scores',
  OUR_BATTING: 'our-batting',
  OUR_BOWLING: 'our-bowling',
  AWARDS: 'awards',
}

export const stepIdForIssue = (step: ResultWizardStep | null | undefined): string | null => (step ? STEP_IDS[step] : null)

// The scorecard's own steps: their issues are never matched by wording (that is for the older, string-only checks).
export const isScorecardStep = (step: ResultWizardStep | null | undefined): boolean =>
  step === 'OUR_BATTING' || step === 'OUR_BOWLING' || step === 'AWARDS'

// The validation as typed issues. A response without `issues` (a server that predates them) is read from its plain error
// and warning lines, which carry no code, step or side.
export function issuesOf(validation: Pick<ResultValidation, 'errors' | 'warnings'> & { issues?: ResultIssue[] | null }): ResultIssue[] {
  if (validation.issues && validation.issues.length > 0) return validation.issues
  return [
    ...validation.errors.map((message): ResultIssue => ({ code: '', step: null, side: null, severity: 'ERROR', message })),
    ...validation.warnings.map((message): ResultIssue => ({ code: '', step: null, side: null, severity: 'WARNING', message })),
  ]
}
