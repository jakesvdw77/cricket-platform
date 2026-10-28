import type { ShareCoreScreenProps } from '../ShareCore'
import type { LeagueContent } from '../../utils/share/leagueShareFormats'
import type { LeagueShareModel } from '../../utils/share/shareLeagueData'

// What every league format screen receives: the shared core (choices, initials, logos, sponsors, title), the one
// LeagueShareModel and the per-share Include phone and email opt-in (never remembered).
export interface LeagueScreenProps extends ShareCoreScreenProps {
  model: LeagueShareModel
  // Everything ticked in step 1 (the model holds only what this format carries), for the left-out note.
  ticked: LeagueContent[]
  includeContact: boolean
  onIncludeContactChange: (next: boolean) => void
}
