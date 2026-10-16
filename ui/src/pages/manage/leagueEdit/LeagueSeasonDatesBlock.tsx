import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Box, MenuItem, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { getLeagueSeasonDates, leagueSeasonDatesKey, putLeagueSeasonDates } from '../../../api/leagueSeasonDatesApi'
import type { LeagueSeasonDates } from '../../../api/leagueSeasonDatesApi'
import { errorDetail } from '../../../utils/errorDetail'

export interface LeagueSeasonDatesBlockProps {
  clubId: string
  leagueId: string
  seasonId: string
  seasonLabel: string
  // Details tab only: when both are given the block shows its own Season select (the other tabs have the header pill).
  seasons?: { id: string; label: string }[]
  onSeasonChange?: (seasonId: string) => void
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

// docs/specs/111-league-season-dates.md: the "Season dates" block above the season-scoped tabs of Edit League. Start and End
// date are both required for the chosen season, saved with their own Save (a PUT that the server may refuse with a message,
// shown as it is, when an existing match would fall outside the range). An amber notice asks for the dates while none exist.
export function LeagueSeasonDatesBlock({ clubId, leagueId, seasonId, seasonLabel, seasons, onSeasonChange }: LeagueSeasonDatesBlockProps) {
  const queryClient = useQueryClient()
  const datesQuery = useQuery({
    queryKey: leagueSeasonDatesKey(clubId, leagueId, seasonId),
    queryFn: () => getLeagueSeasonDates(clubId, leagueId, seasonId),
  })
  const saved = datesQuery.data
  const loaded = datesQuery.isSuccess

  const [draft, setDraft] = useState<DraftState>({ source: '', start: '', end: '' })
  const [showErrors, setShowErrors] = useState(false)
  const currentSource = loaded ? sourceKey(saved, seasonId) : ''
  // Reset the inputs when the saved dates arrive, change or another season is chosen (state adjusted during render).
  if (loaded && draft.source !== currentSource) {
    setDraft({ source: currentSource, start: saved?.startDate ?? '', end: saved?.endDate ?? '' })
    setShowErrors(false)
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
    if (save.isError) save.reset()
  }

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit}
      data-testid="league-season-dates"
      sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Typography variant="subtitle2" component="h2">
        Season dates
      </Typography>

      {seasons && onSeasonChange && (
        <Input
          select
          label="Season"
          value={seasonId}
          onChange={(event) => onSeasonChange(event.target.value)}
          sx={{ '& .MuiInputBase-root': { minHeight: 44 }, maxWidth: { sm: 220 } }}
        >
          {seasons.map((season) => (
            <MenuItem key={season.id} value={season.id} sx={{ minHeight: 44 }}>
              {season.label}
            </MenuItem>
          ))}
        </Input>
      )}

      {loaded && saved === null && (
        <Alert severity="warning" data-testid="season-dates-banner">
          Set the start and end date for {seasonLabel || 'this season'}.
        </Alert>
      )}
      {datesQuery.isError && (
        <Typography variant="body2" color="error.main">
          Couldn&apos;t load the season dates. Please try again.
        </Typography>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
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
          sx={{ '& .MuiInputBase-root': { minHeight: 44 }, maxWidth: { sm: 220 } }}
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
          sx={{ '& .MuiInputBase-root': { minHeight: 44 }, maxWidth: { sm: 220 } }}
        />
        <Button type="submit" disabled={!loaded || save.isPending} sx={{ minHeight: 44 }}>
          {save.isPending ? 'Saving…' : 'Save season dates'}
        </Button>
      </Stack>

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
