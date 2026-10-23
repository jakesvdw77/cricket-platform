import { useState } from 'react'
import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { updateMatchDateTime } from '../../api/matchApi'
import type { Match } from '../../api/matchApi'
import { useLeagueDatesHint } from '../../hooks/useLeagueDatesHint'
import { fromDatetimeLocal, toDatetimeLocal } from '../../utils/datetimeLocal'
import { errorDetail, matchOutsideLeagueDatesMessage } from '../../utils/errorDetail'
import { Button } from '../Button'
import { DateTimeField } from '../DateTimeField'

const TITLE_ID = 'match-date-time-title'

export interface MatchDateTimeDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  matchId: string
  // The match's current date and time (ISO instant), and its league and season for the league-dates hint.
  matchDate: string
  leagueId?: string | null
  seasonId?: string | null
  // Called with the updated match after a successful save; the dialog then closes.
  onSaved: (match: Match) => void
}

// docs/specs/118-result-review-fixes.md: change a match's date and time only (PATCH .../date-time), from the result flow.
// The league's dates are shown as a hint the same way the match form does; the server's refusal shows on the field.
export function MatchDateTimeDialog({ open, onClose, clubId, matchId, matchDate, leagueId, seasonId, onSaved }: MatchDateTimeDialogProps) {
  const [value, setValue] = useState(() => toDatetimeLocal(matchDate))
  const [dateError, setDateError] = useState<string | null>(null)
  const [otherError, setOtherError] = useState<string | null>(null)

  // Each opening starts from the match's current date and time, with no old error.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValue(toDatetimeLocal(matchDate))
      setDateError(null)
      setOtherError(null)
    }
  }

  const { range, outside, message: rangeMessage } = useLeagueDatesHint(clubId, leagueId, seasonId, value, open)

  const mutation = useMutation({
    mutationFn: () => updateMatchDateTime(clubId, matchId, fromDatetimeLocal(value)),
    onSuccess: (match) => {
      onSaved(match)
      onClose()
    },
    onError: (error) => {
      const dates = matchOutsideLeagueDatesMessage(error)
      setDateError(dates)
      setOtherError(dates ? null : errorDetail(error, 'We could not change the date and time. Please try again.'))
    },
  })

  const message = rangeMessage ?? dateError ?? undefined
  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby={TITLE_ID}>
      <DialogTitle id={TITLE_ID}>Edit date and time</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <DateTimeField
            label="Match date & time"
            value={value}
            onChange={(next) => {
              setValue(next)
              setDateError(null)
              setOtherError(null)
            }}
            min={range?.startDate}
            max={range?.endDate}
            error={Boolean(message)}
            helperText={message}
            disabled={mutation.isPending}
          />
          {otherError && <Alert severity="error">{otherError}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="secondary" onClick={onClose} disabled={mutation.isPending} sx={{ minHeight: 44 }}>
          Cancel
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={!value || outside || mutation.isPending} sx={{ minHeight: 44 }}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
