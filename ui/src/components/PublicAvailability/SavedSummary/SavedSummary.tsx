import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Button } from '../../Button'
import type { AvailabilityStatus } from '../../../api/matchAvailabilityApi'
import { STATUS_COLOR, STATUS_LABEL } from '../../../utils/availabilityStatus'

export interface SavedSummaryEntry {
  // "Thu 15 Oct · Morning", or "Your answer" for a squad poll.
  label: string
  status: AvailabilityStatus
}

export interface SavedSummaryProps {
  firstName: string
  entries: SavedSummaryEntry[]
  onChangeAnswer: () => void
  onSomeoneElse: () => void
}

// docs/specs/077: the confirmation after a save. "Answer for someone else" is for a parent with
// more than one child: it goes back to asking a name and date of birth.
export function SavedSummary({ firstName, entries, onChangeAnswer, onSomeoneElse }: SavedSummaryProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0.75, py: 2 }}>
        <Box
          aria-hidden
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: 'success.main',
            color: 'success.contrastText',
            display: 'grid',
            placeItems: 'center',
            fontSize: '1.4rem',
          }}
        >
          ✓
        </Box>
        <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
          Thanks, {firstName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your answer is saved. You can change it any time until the poll closes.
        </Typography>
      </Box>

      <Box
        component="ul"
        aria-label="Your saved answers"
        sx={{ listStyle: 'none', m: 0, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}
      >
        {entries.map((entry) => (
          <Box
            component="li"
            key={entry.label}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}
          >
            <Typography variant="body2">{entry.label}</Typography>
            <Typography
              variant="body2"
              component="span"
              sx={{
                fontWeight: 700,
                px: 0.75,
                borderRadius: 1,
                bgcolor: (theme: Theme) => alpha(theme.palette[STATUS_COLOR[entry.status]].main, 0.12),
                color: `${STATUS_COLOR[entry.status]}.dark`,
              }}
            >
              {STATUS_LABEL[entry.status]}
            </Typography>
          </Box>
        ))}
      </Box>

      <Button onClick={onChangeAnswer}>Change my answer</Button>
      <Button variant="secondary" onClick={onSomeoneElse}>
        Answer for someone else
      </Button>
    </Box>
  )
}
