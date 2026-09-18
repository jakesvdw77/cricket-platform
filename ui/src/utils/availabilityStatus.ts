import type { AvailabilityStatus } from '../api/matchAvailabilityApi'

// Originally private to MatchAvailabilityTab.tsx; pulled out here per docs/specs/
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
