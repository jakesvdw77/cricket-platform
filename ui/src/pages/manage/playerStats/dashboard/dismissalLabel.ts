import { NOT_ON_FILE } from '../../../../utils/playerFormat'
import { DISMISSALS } from '../../../../utils/dismissal'

// The words for a stored dismissal type name ("CAUGHT" -> "Caught"), through the one shared dismissal list.
export function dismissalLabel(type: string | null | undefined): string {
  if (!type) return NOT_ON_FILE
  return DISMISSALS.find((entry) => entry.type === type)?.label ?? type
}
