import { usePlayerLabeler } from '../../hooks/usePlayerLabeler'
import type { NameMode, PersonName } from '../../utils/playerDisplayName'

export interface PlayerNameProps {
  // The player to name.
  person: PersonName
  // The names in the current view (everyone on the screen the label sits in), so a first-name collision is tagged only
  // when both players are visible together. Omit for a name shown alone.
  view?: PersonName[]
  // Overrides the remembered mode (stories, tests).
  mode?: NameMode
}

// docs/specs/101-match-results-our-side-scorecard.md: the ONE component that shows a player's name on a scorecard
// screen (every row, the picker's current row, awards, standouts, the result page), so no screen formats a name itself.
// Full name or First name per the user's remembered preference; a guest's typed name is split into first name and
// surname by playerDisplayName's helpers before it gets here.
export function PlayerName({ person, view, mode }: PlayerNameProps) {
  const label = usePlayerLabeler(view ?? [person], mode)
  return <>{label(person)}</>
}
