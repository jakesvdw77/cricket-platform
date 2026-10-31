import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Box, Tooltip, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { getLeagueSeasonDates, leagueSeasonDatesKey, putLeagueSeasonDates } from '../../../api/leagueSeasonDatesApi'
import type { LeagueSeasonDates } from '../../../api/leagueSeasonDatesApi'
import type { Match } from '../../../api/matchApi'
import { compactFieldSx } from '../../../utils/compactFieldSx'
import { errorDetail } from '../../../utils/errorDetail'
import { toDatetimeLocal } from '../../../utils/datetimeLocal'

// Earliest and latest local date (yyyy-mm-dd) of the active matches, null when there are none.
function matchRange(matches: Match[] | undefined): { first: string; last: string; count: number } | null {
  const days = (matches ?? [])
    .filter((m) => m.active)
    .map((m) => toDatetimeLocal(m.matchDate).slice(0, 10))
    .filter(Boolean)
    .sort()
  return days.length > 0 ? { first: days[0], last: days[days.length - 1], count: days.length } : null
}

function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface LeagueSeasonDatesBlockProps {
  clubId: string
  leagueId: string
  seasonId: string
  seasonLabel: string
  // The active-or-not matches of this league and season the page already holds; feeds "Use first and last match".
  matches?: Match[]
}

interface DraftState {
  // The server values the draft was last reset from; a change here means the saved dates changed or another season was chosen.
  source: string
  start: string
  end: string
}

function sourceKey(dates: LeagueSeasonDates | null | undefined, seasonId: string): string {
  return `${seasonId}|${dates ? `${dates.startDate}|${dates.endDate}` : 'none'}`
}

// docs/specs/111-league-season-dates.md: the "Season dates" row at the top of the Details card of Edit League (docs/specs/128). Start and End
// date are both required for the chosen season, saved with their own Save (a PUT that the server may refuse with a message,
// shown as it is, when an existing match would fall outside the range). An amber notice asks for the dates while none exist.
export function LeagueSeasonDatesBlock({ clubId, leagueId, seasonId, seasonLabel, matches }: LeagueSeasonDatesBlockProps) {
  const queryClient = useQueryClient()
  const datesQuery = useQuery({
    queryKey: leagueSeasonDatesKey(clubId, leagueId, seasonId),
    queryFn: () => getLeagueSeasonDates(clubId, leagueId, seasonId),
  })
  const saved = datesQuery.data
  const loaded = datesQuery.isSuccess

  const [draft, setDraft] = useState<DraftState>({ source: '', start: '', end: '' })
  const [showErrors, setShowErrors] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const range = matchRange(matches)
  const currentSource = loaded ? sourceKey(saved, seasonId) : ''
  // Reset the inputs when the saved dates arrive, change or another season is chosen (state adjusted during render).
  if (loaded && draft.source !== currentSource) {
    setDraft({ source: currentSource, start: saved?.startDate ?? '', end: saved?.endDate ?? '' })
    setShowErrors(false)
    setNote(null)
  }

  const save = useMutation({
    mutationFn: (payload: LeagueSeasonDates) => putLeagueSeasonDates(clubId, leagueId, seasonId, payload),
    onSuccess: () => {
      // The league key covers this league's dates, age reference and season matches; the club's matches list too.
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    },
  })

  const startError = showErrors && !draft.start ? 'Start date is required' : null
  const endError = showErrors && !draft.end ? 'End date is required' : null
  const orderError =
    draft.start && draft.end && draft.start > draft.end ? 'Start date must be on or before the end date' : null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setShowErrors(true)
    if (!draft.start || !draft.end || draft.start > draft.end) {
      return
    }
    save.mutate({ startDate: draft.start, endDate: draft.end })
  }

  const edit = (patch: Partial<Pick<DraftState, 'start' | 'end'>>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setNote(null)
    if (save.isError) save.reset()
  }

  const useMatchRange = () => {
    if (!range) return
    setDraft((prev) => ({ ...prev, start: range.first, end: range.last }))
    setNote(`From ${formatDay(range.first)} to ${formatDay(range.last)}, ${range.count} ${range.count === 1 ? 'match' : 'matches'}`)
    if (save.isError) save.reset()
  }

  const warning = loaded && saved === null
  const fieldSx = { width: { xs: '100%', md: 160 }, bgcolor: 'background.paper', ...compactFieldSx }
  const buttonSx = { width: { xs: '100%', md: 'auto' }, minHeight: { xs: 44, md: 32 }, whiteSpace: 'nowrap' }

  const controls = (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flexWrap: 'wrap', alignItems: { md: 'center' }, gap: 1.25 }}>
      <Typography variant="subtitle2" component="p" sx={{ mr: { md: 1 } }}>
        Season dates for {seasonLabel || 'this season'}
      </Typography>
      <Input
        label="Start date"
        type="date"
        required
        value={draft.start}
        onChange={(event) => edit({ start: event.target.value })}
        error={Boolean(startError || orderError)}
        helperText={startError ?? orderError ?? undefined}
        disabled={!loaded}
        InputLabelProps={{ shrink: true }}
        sx={fieldSx}
      />
      <Input
        label="End date"
        type="date"
        required
        value={draft.end}
        onChange={(event) => edit({ end: event.target.value })}
        error={Boolean(endError)}
        helperText={endError ?? undefined}
        disabled={!loaded}
        InputLabelProps={{ shrink: true }}
        sx={fieldSx}
      />
      <Tooltip title="Set the start and end dates from the earliest and latest match in this schedule">
        <Box component="span" sx={{ display: { xs: 'block', md: 'inline-block' } }}>
          <Button size="compact" variant="secondary" disabled={!loaded || !range} onClick={useMatchRange} sx={buttonSx}>
            Use First and Last Match
          </Button>
        </Box>
      </Tooltip>
      <Button size="compact" type="submit" disabled={!loaded || save.isPending} sx={buttonSx}>
        {save.isPending ? 'Saving…' : 'Save Season Dates'}
      </Button>
    </Box>
  )

  const noteLine = note && (
    <Typography variant="body2" color="text.secondary" role="status" data-testid="season-dates-range-note" sx={{ mt: 0.5 }}>
      {note}
    </Typography>
  )

  return (
    <Box
      component="form"
      noValidate
      aria-label="Season dates"
      onSubmit={handleSubmit}
      data-testid="league-season-dates"
      sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      {warning ? (
        <Alert severity="warning" data-testid="season-dates-banner" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Set the start and end date for {seasonLabel || 'this season'}{range ? ', or use the first and last match' : ''}.
          </Typography>
          {controls}
          {noteLine}
        </Alert>
      ) : (
        <>
          {controls}
          {noteLine}
        </>
      )}
      {datesQuery.isError && (
        <Typography variant="body2" color="error.main">
          Couldn&apos;t load the season dates. Please try again.
        </Typography>
      )}

      {save.isError && (
        <Typography variant="body2" color="error.main" role="alert">
          {errorDetail(save.error, 'Something went wrong saving the season dates. Please try again.')}
        </Typography>
      )}
      {save.isSuccess && (
        <Typography variant="body2" color="success.main" role="status">
          Season dates saved.
        </Typography>
      )}
    </Box>
  )
}
