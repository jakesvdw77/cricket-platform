import { Box, Typography } from '@mui/material'
import type { TeamSelectionPick } from '../../../api/teamSelectionApi'

const markerSx = {
  display: 'inline-flex',
  alignItems: 'center',
  px: 0.5,
  height: 16,
  borderRadius: 0.5,
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1,
  flexShrink: 0,
} as const

const pickName = (pick: Pick<TeamSelectionPick, 'firstName' | 'lastName'>) => `${pick.firstName} ${pick.lastName}`.trim()

// A picked player's name with the small C (captain) and WK (wicketkeeper) markers, shared by the Time slots and Batting
// order views of the Team selection hub (docs/specs/093-team-selection-hub.md).
// `displayName` replaces the shown text (the short name); the full name stays in the tooltip and aria-label.
export function PickedName({ pick, displayName }: { pick: TeamSelectionPick; displayName?: string }) {
  const full = pickName(pick)
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Typography variant="body2" title={displayName ? full : undefined} aria-label={displayName ? full : undefined} sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
        {displayName ?? full}
      </Typography>
      {pick.captain && (
        <Box component="span" sx={markerSx} aria-label="Captain" title="Captain">
          C
        </Box>
      )}
      {pick.wicketKeeper && (
        <Box component="span" sx={markerSx} aria-label="Wicketkeeper" title="Wicketkeeper">
          WK
        </Box>
      )}
    </Box>
  )
}
