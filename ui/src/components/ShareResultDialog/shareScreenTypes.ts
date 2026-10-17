import type { Sponsor } from '../../api/sponsorApi'
import type { ShareChoices } from '../../utils/share/shareChoices'
import type { ShareResultModel } from '../../utils/share/shareResultData'
import type { ShareInitialsState } from './useShareInitials'

// What every format screen receives from ShareResultDialog.
export interface ShareScreenProps {
  // Built with the Teams choice and the Initials only value in force.
  model: ShareResultModel
  choices: ShareChoices
  updateChoices: (next: Partial<ShareChoices>) => void
  initials: ShareInitialsState
  // Candidate sponsors (active, with a logo) and the ids ticked (remembered, else the default).
  sponsors: Sponsor[]
  selectedSponsorIds: string[]
  // Team names only: never a player name (the share title).
  shareTitle: string
}
