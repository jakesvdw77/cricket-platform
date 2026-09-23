import { Avatar, AvatarGroup, Box, Stack, Tooltip, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { alpha } from '@mui/material/styles'
import type { AvailabilityRespondent, AvailabilityStatus } from '../../api/matchAvailabilityApi'
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/availabilityStatus'
import { squadDisplayName } from '../../utils/squadDisplayName'
import { initialsFromName } from '../../utils/initials'

// docs/specs/048-match-availability-wrap-layout.md: a generous cap well above any realistic
// club squad size — bounds a pathological/bulk-imported outlier squad from rendering unboundedly
// in 'wrap' layout, without ever realistically triggering for a normal squad.
export const WRAP_LAYOUT_MAX = 24

export interface AvailabilityRespondentAvatarsProps {
  // Drives this group's tint/label — one of the three response options this dashboard summarizes
  // (see docs/specs/034-availability-polls-dashboard.md's UI Requirements; "No response" has no
  // avatar-group variant of its own, rendered as a plain count elsewhere).
  status: AvailabilityStatus
  respondents: AvailabilityRespondent[]
  // From the DTO's own count field (availableCount/unavailableCount/unsureCount) — kept as its own
  // prop, not derived from respondents.length, so the label is never silently wrong if a caller
  // ever passes a truncated respondents array.
  count: number
  // New, optional, additive. 'compact' (default) is today's exact AvatarGroup/max={4} rendering,
  // byte-for-byte — AvailabilityPollsDashboard.tsx passes no value and is fully unaffected.
  // 'wrap' — MatchDetailPage.tsx's SideAvailability opts in — replaces the single-row
  // max-truncation with a flex-wrap grid of individual, non-overlapping avatars that wraps onto as
  // many lines as needed to show every respondent, up to WRAP_LAYOUT_MAX.
  layout?: 'compact' | 'wrap'
}

// docs/specs/034-availability-polls-dashboard.md's genuinely new visual pattern — the first
// MUI AvatarGroup usage and the first multi-person-avatar rendering in this codebase. A compact
// row: a tinted-per-status AvatarGroup (MUI's own "+N" overflow beyond max) plus an explicit count
// label, so the count is never solely inferred from an overflow avatar. Each avatar reuses
// initialsFromName (RecordCard/PlayerCard's own fallback convention) inside a Tooltip showing the
// respondent's full squad display name (squadDisplayName.ts — "#{jersey} {name}").
export function AvailabilityRespondentAvatars({ status, respondents, count, layout }: AvailabilityRespondentAvatarsProps) {
  const tone = STATUS_COLOR[status]

  // Shared per-avatar sizing/tint/border — referenced by both the 'compact' AvatarGroup branch
  // (via its '& .MuiAvatar-root' selector, exactly as before) and the 'wrap' branch's individual
  // Avatars (applied directly, since there's no AvatarGroup wrapper to select through).
  const avatarSx: SxProps<Theme> = {
    width: 28,
    height: 28,
    fontSize: '0.6875rem',
    fontWeight: 600,
    bgcolor: (theme) => alpha(theme.palette[tone].main, 0.12),
    color: `${tone}.dark`,
    border: (theme) => `1px solid ${theme.palette.background.paper}`,
  }

  const resolvedLayout = layout ?? 'compact'
  const visibleRespondents = respondents.slice(0, WRAP_LAYOUT_MAX)
  const overflowCount = respondents.length - WRAP_LAYOUT_MAX

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {resolvedLayout === 'compact' && respondents.length > 0 && (
        <AvatarGroup
          max={4}
          sx={{
            '& .MuiAvatar-root': avatarSx,
          }}
        >
          {respondents.map((respondent) => (
            <Tooltip key={respondent.playerProfileId} title={squadDisplayName(respondent)}>
              <Avatar>{initialsFromName(`${respondent.firstName} ${respondent.lastName}`)}</Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
      )}
      {resolvedLayout === 'wrap' && respondents.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {visibleRespondents.map((respondent) => (
            <Tooltip key={respondent.playerProfileId} title={squadDisplayName(respondent)}>
              <Avatar sx={avatarSx}>{initialsFromName(`${respondent.firstName} ${respondent.lastName}`)}</Avatar>
            </Tooltip>
          ))}
          {overflowCount > 0 && (
            <Avatar sx={{ ...avatarSx, bgcolor: 'action.hover', color: 'text.secondary' }}>{`+${overflowCount}`}</Avatar>
          )}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {count} {STATUS_LABEL[status]}
      </Typography>
    </Stack>
  )
}
