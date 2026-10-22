import { useState } from 'react'
import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { updateMatchDateTime } from '../../api/matchApi'
import type { Match } from '../../api/matchApi'
import { getLeagueSeasonDates, leagueSeasonDatesKey } from '../../api/leagueSeasonDatesApi'
import { fromDatetimeLocal, toDatetimeLocal } from '../../utils/datetimeLocal'
import { formatReferenceDate } from '../../utils/ageCutoff'
import { errorDetail, matchOutsideLeagueDatesMessage } from '../../utils/errorDetail'
import { Button } from '../Button'
import { DateTimeField } from '../DateTimeField'

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

  const hasScope = Boolean(leagueId && seasonId)
  const datesQuery = useQuery({
    queryKey: leagueSeasonDatesKey(clubId, leagueId ?? '', seasonId ?? ''),
    queryFn: () => getLeagueSeasonDates(clubId, leagueId ?? '', seasonId ?? ''),
    enabled: open && hasScope,
    retry: false,
  })
  const range = hasScope ? (datesQuery.data ?? null) : null
  const day = value.slice(0, 10)
  const outside = Boolean(range && day && (day < range.startDate || day > range.endDate))
  const rangeMessage = outside && range ? `This league runs from ${formatReferenceDate(range.startDate)} to ${formatReferenceDate(range.endDate)}.` : undefined

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
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit date and time</DialogTitle>
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
