import { Box, Button as MuiButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { compactButtonSx } from '../Button'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'

export interface LinkRequestsWaitingCardProps {
  // Requests waiting for a decision. Undefined while loading or when the count failed to load.
  waiting: number | undefined
  // Where "Review requests" goes (the Access screen, Player accounts tab).
  to?: string
}

// docs/specs/119 Part 3, shortcut (a): the small card at the top of the Players list. It renders nothing at 0, while the
// count is loading and when it failed, so it never flashes or shows a wrong figure.
export function LinkRequestsWaitingCard({ waiting, to = '/manage/permissions/player-accounts' }: LinkRequestsWaitingCardProps) {
  if (!waiting || waiting < 1) return null
  const text = `${waiting} link ${waiting === 1 ? 'request' : 'requests'} waiting`
  return (
    <Box
      data-testid="link-requests-waiting-card"
      role="status"
      sx={(theme) => ({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.5,
        border: 1,
        borderColor: alpha(theme.palette.primary.main, 0.35),
        borderRadius: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.05),
      })}
    >
      <Box
        aria-hidden
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText', flex: 'none' }}
      >
        <PersonAddAltOutlinedIcon fontSize="small" />
      </Box>
      <Typography variant="body2" fontWeight={700} sx={{ flex: '1 1 160px' }}>
        {text}
      </Typography>
      {/* A real link styled as the compact outlined button (the shared Button has no router `to`). */}
      <MuiButton component={RouterLink} to={to} variant="outlined" size="small" sx={compactButtonSx}>
        Review requests
      </MuiButton>
    </Box>
  )
}
