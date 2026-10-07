import { Box, Chip, Typography } from '@mui/material'
import { formatDateTime } from '../../../utils/publicAvailabilityFormat'

export interface PublicPollHeaderProps {
  open: boolean
  title: string
  subtitle?: string | null
  // Extra muted lines under the subtitle (league, season, team ...).
  details?: Array<string | null | undefined>
  // ISO instant the poll closes by itself, when there is one.
  scheduledCloseAt?: string | null
}

// docs/specs/077: the top of every public availability screen below the brand strip: Open/Closed
// chip (with "closes ..." while open), the poll's title and its context lines.
export function PublicPollHeader({ open, title, subtitle, details = [], scheduledCloseAt }: PublicPollHeaderProps) {
  const chipLabel = open ? (scheduledCloseAt ? `Open · closes ${formatDateTime(scheduledCloseAt)}` : 'Open') : 'Closed'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Chip
        size="small"
        label={chipLabel}
        variant="outlined"
        color={open ? 'primary' : 'default'}
        sx={{ alignSelf: 'flex-start', bgcolor: 'background.paper', fontWeight: 700 }}
      />
      <Typography variant="h5" component="h1" sx={{ mt: 0.5, fontWeight: 700, fontSize: { xs: '1.2rem', sm: '1.4rem' } }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
      {details.filter(Boolean).map((line) => (
        <Typography key={line} variant="body2" color="text.secondary">
          {line}
        </Typography>
      ))}
    </Box>
  )
}
