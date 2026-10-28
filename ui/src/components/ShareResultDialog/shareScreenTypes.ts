import type { ShareCoreScreenProps } from '../ShareCore/shareScreenTypes'
import type { ShareResultModel } from '../../utils/share/shareResultData'

export type { ShareCoreScreenProps }

// What every format screen receives from ShareResultDialog.
export interface ShareScreenProps extends ShareCoreScreenProps {
  // Built with the Teams choice and the First names as initials value in force (the text formats read this).
  model: ShareResultModel
  // The same result with BOTH teams always, for the Image and TV cards and the attached image: they never offer Our team only.
  cardModel: ShareResultModel
}
