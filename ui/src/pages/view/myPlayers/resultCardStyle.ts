import { alpha } from '@mui/material/styles'
import { BRAND, RESULT_TONES, blackAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import type { ResultTone } from './resultsFormat'

// docs/specs/145: the look shared by the Player Hub result cards and the hero (kept out of the component files so they only export components).
export const cardSx = (tone: ResultTone) =>
  ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 0.75,
    minWidth: 0,
    p: '20px 18px 14px',
    borderRadius: '22px',
    border: `1px solid ${HUB.lineSoft}`,
    overflow: 'hidden',
    background:
      tone === 'win'
        ? `linear-gradient(160deg, ${alpha(BRAND.gold, 0.2)}, ${blackAlpha(0.22)} 55%)`
        : tone === 'loss'
          ? `linear-gradient(160deg, ${alpha(RESULT_TONES.lossTint, 0.26)}, ${blackAlpha(0.22)} 55%)`
          : tone === 'tie'
            ? `linear-gradient(160deg, ${alpha(BRAND.sand, 0.18)}, ${blackAlpha(0.22)} 55%)`
            : blackAlpha(0.22),
  }) as const

export const kickerSx = { fontFamily: HUB.display, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: HUB.gold } as const
export const bigSx = { fontFamily: HUB.display, fontWeight: 700, lineHeight: 0.88, letterSpacing: '0.01em' } as const

