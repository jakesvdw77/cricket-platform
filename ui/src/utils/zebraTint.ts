import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

// docs/specs/087-matches-polls-alignment.md: the one alternate-row tint (the Players grid, the Responses
// by-player list, the match card's Selection rows) so a name or row can be followed across.
export const ZEBRA_TINT_AMOUNT = 0.95

// Opaque (never alpha), so a sticky cell never lets scrolled content show through.
export const zebraTint = (theme: Theme) => lighten(theme.palette.primary.main, ZEBRA_TINT_AMOUNT)
