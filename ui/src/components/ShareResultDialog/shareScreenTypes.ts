import type { Sponsor } from '../../api/sponsorApi'
import type { ShareChoices } from '../../utils/share/shareChoices'
import type { ShareResultModel } from '../../utils/share/shareResultData'
import type { ShareInitialsState } from './useShareInitials'

// What every format screen receives from ShareResultDialog.
export interface ShareScreenProps {
  // Built with the Teams choice and the Initials only value in force (the text formats read this).
  model: ShareResultModel
  // The same result with BOTH teams always, for the Image and TV cards and the attached image: they never offer Our team only.
  cardModel: ShareResultModel
  choices: ShareChoices
  updateChoices: (next: Partial<ShareChoices>) => void
  initials: ShareInitialsState
  // Candidate sponsors (active, with a logo) and the ids ticked (remembered, else the default).
  sponsors: Sponsor[]
  selectedSponsorIds: string[]
  // What the club and league logos and the footer line draw from (null when the read is not allowed or there is none).
  clubLogoUrl: string | null
  leagueLogoUrl: string | null
  clubWebsite: string | null
  // Team names only: never a player name (the share title).
  shareTitle: string
}
