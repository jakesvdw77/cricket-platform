import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, MenuItem, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Input } from '../Input'
import type { MatchPayload } from '../../api/matchApi'
import type { Season } from '../../api/seasonApi'
import type { League } from '../../api/leagueApi'
import type { Team } from '../../api/teamApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see MatchFormPage), same pattern as LEAGUE_FORM_ID/SEASON_FORM_ID.
export const MATCH_FORM_ID = 'match-form'

type SideMode = 'team' | 'external'

export interface MatchFormProps {
  initialValues?: Partial<MatchPayload>
  // The current club's own teams only — cross-club Team references stay backend-supported (any
  // club's Team id is a valid homeTeamId/awayTeamId) but this pass's UI only ever lets an admin
  // pick from their own club's teams (docs/specs/029-league-management.md's Rollout Notes).
  teams: Team[]
  seasons: Season[]
  leagues: League[]
  onSubmit: (payload: MatchPayload) => void
}

interface FormState {
  homeMode: SideMode
  homeTeamId: string
  homeTeamName: string
  awayMode: SideMode
  awayTeamId: string
  awayTeamName: string
  leagueId: string
  seasonId: string
  matchDate: string
  venue: string
}

type FormErrors = Partial<Record<'homeTeamId' | 'homeTeamName' | 'awayTeamId' | 'awayTeamName' | 'seasonId' | 'matchDate', string>>

// HTML <input type="datetime-local"> has no timezone of its own — treated as the browser's local
// time on both read and write, converted to/from a real ISO Instant string (Match.matchDate) at
// the form's edges only.
function toDatetimeLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString()
}

function toFormState(initialValues?: Partial<MatchPayload>): FormState {
  return {
    homeMode: initialValues?.homeTeamName ? 'external' : 'team',
    homeTeamId: initialValues?.homeTeamId ?? '',
    homeTeamName: initialValues?.homeTeamName ?? '',
    awayMode: initialValues?.awayTeamName ? 'external' : 'team',
    awayTeamId: initialValues?.awayTeamId ?? '',
    awayTeamName: initialValues?.awayTeamName ?? '',
    leagueId: initialValues?.leagueId ?? '',
    seasonId: initialValues?.seasonId ?? '',
    matchDate: initialValues?.matchDate ? toDatetimeLocal(initialValues.matchDate) : '',
    venue: initialValues?.venue ?? '',
  }
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (values.homeMode === 'team' && !values.homeTeamId) {
    errors.homeTeamId = 'Choose a home team'
  }
  if (values.homeMode === 'external' && !values.homeTeamName.trim()) {
    errors.homeTeamName = 'Enter the opponent name'
  }
  if (values.awayMode === 'team' && !values.awayTeamId) {
    errors.awayTeamId = 'Choose an away team'
  }
  if (values.awayMode === 'external' && !values.awayTeamName.trim()) {
    errors.awayTeamName = 'Enter the opponent name'
  }
  if (!values.seasonId) {
    errors.seasonId = 'Season is required'
  }
  if (!values.matchDate) {
    errors.matchDate = 'Match date is required'
  }

  return errors
}

// Per side (Home/Away): a toggle between "One of our teams" (a Select over the current club's
// own teams) and "External opponent" (free-text) — docs/specs/029-league-management.md's UI
// Requirements. Season is required (squad membership is season-scoped); League stays optional
// and independent.
export function MatchForm({ initialValues, teams, seasons, leagues, onSubmit }: MatchFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const handleTextChange = (field: 'homeTeamName' | 'awayTeamName' | 'venue') => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: MatchPayload = {
      homeTeamId: values.homeMode === 'team' ? values.homeTeamId : null,
      homeTeamName: values.homeMode === 'external' ? values.homeTeamName.trim() : null,
      awayTeamId: values.awayMode === 'team' ? values.awayTeamId : null,
      awayTeamName: values.awayMode === 'external' ? values.awayTeamName.trim() : null,
      leagueId: values.leagueId || null,
      seasonId: values.seasonId,
      matchDate: fromDatetimeLocal(values.matchDate),
      venue: values.venue.trim() ? values.venue.trim() : null,
    }
    onSubmit(payload)
  }

  return (
    <Box component="form" id={MATCH_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      <Input
        select
        label="Season"
        value={values.seasonId}
        onChange={(event) => setValues((prev) => ({ ...prev, seasonId: event.target.value }))}
        error={Boolean(errors.seasonId)}
        helperText={errors.seasonId}
      >
        {seasons.map((season) => (
          <MenuItem key={season.id} value={season.id}>
            {season.label}
          </MenuItem>
        ))}
      </Input>

      <Input
        select
        label="League"
        value={values.leagueId}
        onChange={(event) => setValues((prev) => ({ ...prev, leagueId: event.target.value }))}
        helperText="Optional — leave blank for a standalone friendly"
      >
        <MenuItem value="">None</MenuItem>
        {leagues.map((league) => (
          <MenuItem key={league.id} value={league.id}>
            {league.name}
          </MenuItem>
        ))}
      </Input>

      <Input
        label="Match date & time"
        type="datetime-local"
        value={values.matchDate}
        onChange={(event) => setValues((prev) => ({ ...prev, matchDate: event.target.value }))}
        error={Boolean(errors.matchDate)}
        helperText={errors.matchDate}
        InputLabelProps={{ shrink: true }}
      />

      <Input label="Venue" value={values.venue} onChange={handleTextChange('venue')} helperText="Optional" />

      <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Home side
        </Typography>
        <ToggleButtonGroup
          value={values.homeMode}
          exclusive
          fullWidth
          onChange={(_event, next: SideMode | null) => next && setValues((prev) => ({ ...prev, homeMode: next }))}
        >
          <ToggleButton value="team">One of our teams</ToggleButton>
          <ToggleButton value="external">External opponent</ToggleButton>
        </ToggleButtonGroup>

        {values.homeMode === 'team' ? (
          <Input
            select
            label="Home team"
            value={values.homeTeamId}
            onChange={(event) => setValues((prev) => ({ ...prev, homeTeamId: event.target.value }))}
            error={Boolean(errors.homeTeamId)}
            helperText={errors.homeTeamId}
          >
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Input>
        ) : (
          <Input
            label="Home opponent name"
            value={values.homeTeamName}
            onChange={handleTextChange('homeTeamName')}
            error={Boolean(errors.homeTeamName)}
            helperText={errors.homeTeamName ?? 'e.g. Riverside Occasionals'}
          />
        )}
      </Box>

      <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Away side
        </Typography>
        <ToggleButtonGroup
          value={values.awayMode}
          exclusive
          fullWidth
          onChange={(_event, next: SideMode | null) => next && setValues((prev) => ({ ...prev, awayMode: next }))}
        >
          <ToggleButton value="team">One of our teams</ToggleButton>
          <ToggleButton value="external">External opponent</ToggleButton>
        </ToggleButtonGroup>

        {values.awayMode === 'team' ? (
          <Input
            select
            label="Away team"
            value={values.awayTeamId}
            onChange={(event) => setValues((prev) => ({ ...prev, awayTeamId: event.target.value }))}
            error={Boolean(errors.awayTeamId)}
            helperText={errors.awayTeamId}
          >
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Input>
        ) : (
          <Input
            label="Away opponent name"
            value={values.awayTeamName}
            onChange={handleTextChange('awayTeamName')}
            error={Boolean(errors.awayTeamName)}
            helperText={errors.awayTeamName ?? 'e.g. Riverside Occasionals'}
          />
        )}
      </Box>
    </Box>
  )
}
