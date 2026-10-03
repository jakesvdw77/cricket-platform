import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { AvailabilityStatus } from '../api/matchAvailabilityApi'

// Originally private to the (since removed) match Availability tab; pulled out here per docs/specs/
// 034-availability-polls-dashboard.md's Rollout Notes so AvailabilityRespondentAvatars can reuse
// the exact same tint/label convention rather than a second, copy-pasted map.
export const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
  UNSURE: 'Unsure',
}

// 'success'/'error'/'warning' — MUI palette keys, matching this codebase's existing
// RecordCard.tsx tinted-badge convention (alpha(theme.palette.X.main, ~0.12) for the background,
// the full-saturation X.main/X.dark for the text) rather than a plain filled Chip.
export const STATUS_COLOR: Record<AvailabilityStatus, 'success' | 'error' | 'warning'> = {
  AVAILABLE: 'success',
  UNAVAILABLE: 'error',
  UNSURE: 'warning',
}

// docs/specs/065: the tinted-status sx (12% tone background + the tone's dark text) as one helper
// for the group poll responses views, instead of another inline copy of the same convention.
export function statusTintSx(status: AvailabilityStatus) {
  const tone = STATUS_COLOR[status]
  return {
    bgcolor: (theme: Theme) => alpha(theme.palette[tone].main, 0.12),
    color: `${tone}.dark`,
    fontWeight: 600,
  }
}
