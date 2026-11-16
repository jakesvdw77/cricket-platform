import type { Sponsor } from '../../api/sponsorApi'
import type { ShareChoices, ShareChoicesPatch } from '../../utils/share/shareChoices'
import type { ShareInitialsState } from './useShareInitials'

// What every share format screen receives whatever the content (a result or a league): remembered choices, the
// initials state, sponsors, logo sources and the share title. Content-specific screens extend it with their own model.
export interface ShareCoreScreenProps {
  choices: ShareChoices
  updateChoices: (next: ShareChoicesPatch) => void
  initials: ShareInitialsState
  // Candidate sponsors (active, with a logo) and the ids ticked (remembered, else the default).
  sponsors: Sponsor[]
  selectedSponsorIds: string[]
  // What the club and league logos and the footer line draw from (null when the read is not allowed or there is none).
  clubLogoUrl: string | null
  // Omitted by a share that has no league (the squad poster): its League logo switch is then not offered at all.
  leagueLogoUrl?: string | null
  // docs/specs/154: our team's and the league's affiliation logos (match share only; omitted elsewhere, so their switches stay hidden).
  teamAffiliationLogoUrl?: string | null
  leagueAffiliationLogoUrl?: string | null
  clubWebsite: string | null
  // Names of teams, leagues or clubs only: never a player name (the share title).
  shareTitle: string
}
