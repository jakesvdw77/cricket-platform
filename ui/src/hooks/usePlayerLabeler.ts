import { usePlayerNameMode } from './usePlayerNameMode'
import { playerLabeler } from '../utils/playerDisplayName'
import type { NameMode, PersonName } from '../utils/playerDisplayName'

// The labels of a view for the remembered (or given) name mode, as a function from a person to its label. Use it where a
// plain string is needed: accessible names ("Runs, A. Smith"), menu titles, confirm messages. `view` is everyone shown
// together on the screen, so a first-name collision is tagged only when both players are visible at once. Cheap (one pass
// over a view of a few dozen names), so it is not memoised.
export function usePlayerLabeler(view: PersonName[] = [], mode?: NameMode): (person: PersonName) => string {
  const [remembered] = usePlayerNameMode()
  return playerLabeler(view, mode ?? remembered)
}
