import { ToggleButton } from '@mui/material'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { SHARE_TEXT_SIZES, SHARE_TEXT_SIZE_LABELS } from '../../utils/share/textSize'
import type { ShareTextSize } from '../../utils/share/textSize'
import { ShareControlGroup } from './ShareControlGroup'
import type { ShareCoreScreenProps } from './shareScreenTypes'

// The Text Size group every picture template shows (result and match image and TV, league poster): Auto, Large, Larger, Largest. One
// remembered choice for all of them. Each step scales the Auto size up and never past what fits the picture.
export function ShareTextSizeControl({ choices, updateChoices, guard = (change) => change() }: Pick<ShareCoreScreenProps, 'choices' | 'updateChoices'> & { guard?: (change: () => void) => void }) {
  return (
    <ShareControlGroup label="Text Size">
      <CompactToggleGroup value={choices.textSize} ariaLabel="Text size" fullWidthOnPhone onChange={(next: ShareTextSize) => guard(() => updateChoices({ textSize: next }))}>
        {SHARE_TEXT_SIZES.map((item) => (
          <ToggleButton key={item} value={item}>
            {SHARE_TEXT_SIZE_LABELS[item]}
          </ToggleButton>
        ))}
      </CompactToggleGroup>
    </ShareControlGroup>
  )
}
