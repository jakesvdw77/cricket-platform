import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { BRAND, GOLD_DISC_GRADIENT } from '../../brandTokens'

// The shared avatar treatment. docs/specs/120 Decisions 9 and 19: a gold disc (a radial from the light to the solid gold)
// with dark green initials in the display face, for every avatar, whatever the club's colour (it was the solid
// `primary.main` and white text). A photo or logo is unchanged (it covers the disc). `size` covers both list-card and
// detail-header avatars alike (56px for a record's own primary avatar), `fontSize` defaults to the size that pairs with a
// 56px avatar; smaller avatar contexts (icon grids, logo rows, the account menu) pass their own existing fontSize
// explicitly. A caller that wants a muted look overrides `bgcolor` and sets `backgroundImage: 'none'`.
// `options.hasImage`: a logo or photo is shown with no tile (transparent, no gold disc) and scaled with object-fit contain, so
// transparent corners do not show gold; the same size and radius. Without an image the gold tile stays (initials or icon).
export function avatarSx(size: number, fontSize?: string, options: { hasImage?: boolean; kind?: 'record' | 'person' } = {}) {
  if (options.hasImage) {
    return {
      width: size,
      height: size,
      flex: 'none' as const,
      bgcolor: 'transparent',
      backgroundImage: 'none',
      '& img': { objectFit: 'contain' as const },
    }
  }
  // 'record' (a league, team, field or sponsor without a logo) is the soft green tint of the league table's team tiles;
  // 'person' (the default: players, contacts, the account avatar) keeps the gold disc.
  const tile =
    options.kind === 'record'
      ? { bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.14), backgroundImage: 'none', color: 'primary.dark' }
      : { bgcolor: BRAND.gold, backgroundImage: GOLD_DISC_GRADIENT, color: BRAND.green900 }
  return {
    width: size,
    height: size,
    flex: 'none' as const,
    fontFamily: (theme: Theme) => theme.typography.fontFamilyDisplay,
    fontSize: fontSize ?? '1.125rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    ...tile,
  }
}

