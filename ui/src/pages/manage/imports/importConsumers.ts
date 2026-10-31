import type { LeagueScheduleOrigin } from '../../../utils/leagueScheduleImport'
import { LEAGUE_SCHEDULE_IMPORT_TYPE } from '../../../utils/leagueScheduleImport'
import type { ImportConsumerWizardProps } from '../leagueImport/useLeagueScheduleWizardProps'
import { useLeagueScheduleWizardProps } from '../leagueImport/useLeagueScheduleWizardProps'

// docs/specs/097-import-framework.md, "Generic frontend": the registry of import consumers, import type to the wizard
// configuration that type needs (columns, wording, result links, the keys to refresh). The generic resume route reads it, so
// a resumed batch of a known type opens with its own columns and words; the consumer's own page reads the same entry.
// A hook per type (not a plain object) because a configuration may need data, such as the league's name. It returns null
// while that loads. A type with no entry is shown by the generic wizard.
export interface ImportConsumer {
  useWizardProps: (clubId: string, params: Record<string, string>, options?: { from?: LeagueScheduleOrigin }) => ImportConsumerWizardProps | null
}

export const IMPORT_CONSUMERS: Record<string, ImportConsumer> = {
  [LEAGUE_SCHEDULE_IMPORT_TYPE]: { useWizardProps: useLeagueScheduleWizardProps },
}
