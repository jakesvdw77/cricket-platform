import type { ShareCoreScreenProps } from '../ShareCore'
import type { FunFact } from '../../utils/share/matchFunFacts'
import type { MatchLayout, MatchSideChoice } from '../../utils/share/matchShareFormats'
import type { MatchShareModel } from '../../utils/share/shareMatchData'
import type { PictureSettings } from '../../utils/share/matchImage'

// The chosen poster picture: held in memory only and gone when the dialog closes (docs/specs/131).
export interface MatchPictureState {
  image: HTMLImageElement | null
  name: string | null
  settings: PictureSettings
  choose: (file: File) => void
  remove: () => void
  setSettings: (patch: Partial<PictureSettings>) => void
  error: string | null
}

// What every match format screen receives: the shared core (choices, initials, logos, sponsors, title), the one
// MatchShareModel and the per-share choices the controls change.
export interface MatchScreenProps extends ShareCoreScreenProps {
  model: MatchShareModel
  side: MatchSideChoice
  onSideChange: (side: MatchSideChoice) => void
  // Why a side choice is unavailable (null when it is available).
  sideGaps: Record<MatchSideChoice, string | null>
  layout: MatchLayout
  onLayoutChange: (layout: MatchLayout) => void
  // The reason the Include weather switch is off (no forecast), or null when a forecast exists.
  weatherReason: string | null
  // Every fact the data supports and the ones ticked for this share.
  facts: FunFact[]
  tickedFactIds: string[]
  onToggleFact: (id: string) => void
  picture: MatchPictureState
  // Sponsor name for "Mention the sponsor" (the first chosen sponsor with a name), if any.
  sponsorName: string | null
}
