import { Avatar, AvatarGroup, Stack, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { AvailabilityRespondent, AvailabilityStatus } from '../../api/matchAvailabilityApi'
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/availabilityStatus'
import { squadDisplayName } from '../../utils/squadDisplayName'
import { initialsFromName } from '../../utils/initials'

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
}

// docs/specs/034-availability-polls-dashboard.md's genuinely new visual pattern — the first
// MUI AvatarGroup usage and the first multi-person-avatar rendering in this codebase. A compact
// row: a tinted-per-status AvatarGroup (MUI's own "+N" overflow beyond max) plus an explicit count
// label, so the count is never solely inferred from an overflow avatar. Each avatar reuses
// initialsFromName (RecordCard/PlayerCard's own fallback convention) inside a Tooltip showing the
// respondent's full squad display name (squadDisplayName.ts — "#{jersey} {name}").
export function AvailabilityRespondentAvatars({ status, respondents, count }: AvailabilityRespondentAvatarsProps) {
  const tone = STATUS_COLOR[status]

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {respondents.length > 0 && (
        <AvatarGroup
          max={4}
          sx={{
            '& .MuiAvatar-root': {
              width: 28,
              height: 28,
              fontSize: '0.6875rem',
              fontWeight: 600,
              bgcolor: (theme) => alpha(theme.palette[tone].main, 0.12),
              color: `${tone}.dark`,
              border: (theme) => `1px solid ${theme.palette.background.paper}`,
            },
          }}
        >
          {respondents.map((respondent) => (
            <Tooltip key={respondent.playerProfileId} title={squadDisplayName(respondent)}>
              <Avatar>{initialsFromName(`${respondent.firstName} ${respondent.lastName}`)}</Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {count} {STATUS_LABEL[status]}
      </Typography>
    </Stack>
  )
}
