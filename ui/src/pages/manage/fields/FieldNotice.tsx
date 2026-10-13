import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import type { ReactNode } from 'react'
import { fieldStatusOf } from '../../../utils/fieldStatus'
import type { PlayingArea } from '../../../api/playingAreaApi'

// docs/specs/099-fields-directory.md (4): the persistent notice above an unverified (amber) or rejected (red) field's cards,
// built like the Player page's status banner. A verified field shows nothing. `action` is the platform admin's button.
export function FieldNotice({ field, platform = false, action }: { field: PlayingArea; platform?: boolean; action?: ReactNode }) {
  const status = fieldStatusOf(field)
  if (status === 'verified') return null
  const unverified = status === 'unverified'
  return (
    <Box
      role="status"
      data-testid="field-status-notice"
      data-tone={unverified ? 'warning' : 'closed'}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 1,
        border: 1,
        bgcolor: (theme) => alpha(unverified ? theme.palette.warning.main : theme.palette.error.main, 0.14),
        borderColor: (theme) => alpha(unverified ? theme.palette.warning.main : theme.palette.error.main, 0.5),
        color: unverified ? 'warning.dark' : 'error.dark',
      }}
    >
      <ErrorOutlineIcon fontSize="small" />
      <Typography variant="body2" sx={{ flex: '1 1 220px' }}>
        {unverified ? (
          <>
            <b>This field has not been verified yet.</b>{' '}
            {platform ? 'Check the details, then verify or reject it.' : 'Check the address before you share it with players.'}
          </>
        ) : (
          <>
            <b>This field was rejected.</b> It no longer appears in search, and a match using it cannot be saved until another field is chosen.
            {field.rejectionReason ? ` Reason: ${field.rejectionReason}` : ''}
          </>
        )}
      </Typography>
      {action}
    </Box>
  )
}
