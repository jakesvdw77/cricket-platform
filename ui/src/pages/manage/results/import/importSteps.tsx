import { MatchStep } from './MatchStep'
import { SourceStep } from './SourceStep'
import { TeamsMappingStep } from './TeamsMappingStep'
import type { ImportStepRegistration } from './importWizardTypes'

// docs/specs/104-match-results-import-adaptors.md: the import wizard's steps as data, exactly like the capture wizard's
// RESULT_STEPS: a new step is a new entry here, not another branch in the page. The page renders the stepper and the active
// step from this list.
export const IMPORT_STEPS: ImportStepRegistration[] = [
  { id: 'source', label: 'Source', render: (context) => <SourceStep {...context} /> },
  { id: 'match', label: 'Match', render: (context) => <MatchStep {...context} /> },
  { id: 'teams', label: 'Teams', render: (context) => <TeamsMappingStep {...context} /> },
]
