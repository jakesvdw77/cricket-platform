import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Alert, Box, MenuItem } from '@mui/material'
import { Input } from '../Input'
import { MatchSideFields } from './MatchSideFields'
import type { SideMode, SideState } from './MatchSideFields'
import type { MatchPayload } from '../../api/matchApi'
import { fromDatetimeLocal, toDatetimeLocal } from '../../utils/datetimeLocal'
import type { Season } from '../../api/seasonApi'
import type { League } from '../../api/leagueApi'
import type { Team } from '../../api/teamApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'
import type { LeagueTeam } from '../../api/leagueTeamApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see MatchFormPage), same pattern as LEAGUE_FORM_ID/SEASON_FORM_ID.
export const MATCH_FORM_ID = 'match-form'

export interface MatchFormProps {
  initialValues?: Partial<MatchPayload>
  // The current club's own teams only — cross-club Team references stay backend-supported (any
  // club's Team id is a valid homeTeamId/awayTeamId) but this pass's UI only ever lets an admin
  // pick from their own club's teams (docs/specs/029-league-management.md's Rollout Notes).
  teams: Team[]
  seasons: Season[]
  leagues: League[]
  // docs/specs/029-league-management.md: every LeagueAffiliation for the club (across every
  // League/Season, not just the currently-selected one) — narrows the Home/Away team pickers to
  // teams actually entered into the selected League for the selected Season, once both are picked.
  affiliations: LeagueAffiliation[]
  // docs/specs/070-league-teams.md: the registered league teams (active and inactive) for the
  // League and Season currently chosen in the form; the parent fetches them in response to
  // onScopeChange. Omitted for a caller that cannot use league teams.
  leagueTeams?: LeagueTeam[]
  leagueTeamsLoading?: boolean
  // Only club admins may read league teams (the list endpoint is club-admin only); everyone else
  // keeps My team / Other.
  canUseLeagueTeams?: boolean
  // Called on mount and whenever the chosen league or season changes (either id may be '').
  onScopeChange?: (leagueId: string, seasonId: string) => void
  onSubmit: (payload: MatchPayload) => void
}

interface FormState {
  home: SideState
  away: SideState
  leagueId: string
  seasonId: string
  matchDate: string
  venue: string
  scoringUrl: string
  streamingUrl: string
}

type FormErrors = Partial<
  Record<
    | 'homeTeamId'
    | 'homeTeamName'
    | 'homeLeagueTeamId'
    | 'awayTeamId'
    | 'awayTeamName'
    | 'awayLeagueTeamId'
    | 'seasonId'
    | 'matchDate'
    | 'scoringUrl'
    | 'streamingUrl',
    string
  >
>

// A stored league-team side opens on League team, free text on Other (not auto-matched to a
// league team), otherwise My team.
function toSideState(
  teamId: string | null | undefined,
  teamName: string | null | undefined,
  logoUrl: string | null | undefined,
  leagueTeamId: string | null | undefined,
): SideState {
  const mode: SideMode = leagueTeamId ? 'leagueTeam' : teamName ? 'external' : 'team'
  return {
    mode,
    teamId: teamId ?? '',
    teamName: teamName ?? '',
    // The logo of a league-team side belongs to the league team, so it is not held in the form.
    teamLogoUrl: mode === 'external' ? (logoUrl ?? '') : '',
    leagueTeamId: leagueTeamId ?? '',
  }
}

function toFormState(initialValues?: Partial<MatchPayload>): FormState {
  return {
    home: toSideState(
      initialValues?.homeTeamId,
      initialValues?.homeTeamName,
      initialValues?.homeTeamLogoUrl,
      initialValues?.homeLeagueTeamId,
    ),
    away: toSideState(
      initialValues?.awayTeamId,
      initialValues?.awayTeamName,
      initialValues?.awayTeamLogoUrl,
      initialValues?.awayLeagueTeamId,
    ),
    leagueId: initialValues?.leagueId ?? '',
    seasonId: initialValues?.seasonId ?? '',
    matchDate: initialValues?.matchDate ? toDatetimeLocal(initialValues.matchDate) : '',
    venue: initialValues?.venue ?? '',
    scoringUrl: initialValues?.scoringUrl ?? '',
    streamingUrl: initialValues?.streamingUrl ?? '',
  }
}

const MAX_LINK_LENGTH = 1024
const LINK_PATTERN = /^https?:\/\/\S+$/i

// docs/specs/075-match-view-and-edit.md section 6: a trimmed blank link is valid (stored as null);
// otherwise it must start with http:// or https:// (no silent prefixing) and be at most 1024
// characters. Returns the error message, or null when valid.
export function validateMatchLink(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length > MAX_LINK_LENGTH) {
    return 'Link must be 1024 characters or fewer'
  }
  if (!LINK_PATTERN.test(trimmed)) {
    return 'Enter a valid link starting with http:// or https://'
  }
  return null
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (values.home.mode === 'team' && !values.home.teamId) {
    errors.homeTeamId = 'Choose a home team'
  }
  if (values.home.mode === 'external' && !values.home.teamName.trim()) {
    errors.homeTeamName = 'Enter the opponent name'
  }
  if (values.home.mode === 'leagueTeam' && !values.home.leagueTeamId) {
    errors.homeLeagueTeamId = 'Choose a home league team'
  }
  if (values.away.mode === 'team' && !values.away.teamId) {
    errors.awayTeamId = 'Choose an away team'
  }
  if (values.away.mode === 'external' && !values.away.teamName.trim()) {
    errors.awayTeamName = 'Enter the opponent name'
  }
  if (values.away.mode === 'leagueTeam' && !values.away.leagueTeamId) {
    errors.awayLeagueTeamId = 'Choose an away league team'
  }
  if (!values.seasonId) {
    errors.seasonId = 'Season is required'
  }
  if (!values.matchDate) {
    errors.matchDate = 'Match date is required'
  }
  const scoringError = validateMatchLink(values.scoringUrl)
  if (scoringError) {
    errors.scoringUrl = scoringError
  }
  const streamingError = validateMatchLink(values.streamingUrl)
  if (streamingError) {
    errors.streamingUrl = streamingError
  }

  return errors
}

// What one side sends: exactly one of a team id, a free-text name (+ optional logo), or a league
// team id alone (the server supplies name and logo).
function sidePayload(side: SideState) {
  return {
    teamId: side.mode === 'team' ? side.teamId : null,
    teamName: side.mode === 'external' ? side.teamName.trim() : null,
    teamLogoUrl: side.mode === 'external' ? side.teamLogoUrl || null : null,
    leagueTeamId: side.mode === 'leagueTeam' ? side.leagueTeamId : null,
  }
}

// Per side (Home/Away): a three-way toggle between My team (a Select over the current club's own
// teams), League team (docs/specs/070-league-teams.md, club admins only) and Other (free text) —
// see MatchSideFields. Season is required (squad membership is season-scoped); League stays
// optional and independent.
export function MatchForm({
  initialValues,
  teams,
  seasons,
  leagues,
  affiliations,
  leagueTeams = [],
  leagueTeamsLoading = false,
  canUseLeagueTeams = false,
  onScopeChange,
  onSubmit,
}: MatchFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})
  const [leagueTeamsNotice, setLeagueTeamsNotice] = useState(false)

  const hasScope = Boolean(values.leagueId && values.seasonId)

  useEffect(() => {
    onScopeChange?.(values.leagueId, values.seasonId)
  }, [onScopeChange, values.leagueId, values.seasonId])

  const updateSide = (side: 'home' | 'away', patch: Partial<SideState>) => {
    setValues((prev) => ({ ...prev, [side]: { ...prev[side], ...patch } }))
  }

  // A league team belongs to one league and season, so changing either clears a league-team side
  // (the server would 400 otherwise) and tells the user.
  const changeScope = (patch: Partial<Pick<FormState, 'leagueId' | 'seasonId'>>) => {
    const clears = (side: SideState) => side.mode === 'leagueTeam' && side.leagueTeamId !== ''
    setValues((prev) => {
      const cleared = (side: SideState): SideState =>
        clears(side) ? { ...side, mode: 'team', teamId: '', teamName: '', leagueTeamId: '' } : side
      return { ...prev, ...patch, home: cleared(prev.home), away: cleared(prev.away) }
    })
    if (clears(values.home) || clears(values.away)) {
      setLeagueTeamsNotice(true)
    }
  }

  // Only narrows once both League and Season are picked — LeagueAffiliation rows are always
  // season-scoped, so a League chosen before Season would otherwise (incorrectly) show zero
  // affiliated teams rather than "not narrowed yet". null means "no restriction" (a standalone
  // friendly with no League, or Season not yet chosen) — every team stays offered.
  const affiliatedTeamIds = useMemo(() => {
    if (!values.leagueId || !values.seasonId) {
      return null
    }
    return new Set(
      affiliations
        .filter((a) => a.leagueId === values.leagueId && a.seasonId === values.seasonId)
        .map((a) => a.teamId),
    )
  }, [affiliations, values.leagueId, values.seasonId])

  // Never hides a side's own already-selected team, even if it falls outside the narrowed set
  // (editing a match from before this narrowing existed, or a since-removed affiliation) — only
  // narrows what's offered for a NEW pick, never silently discards existing form state.
  const homeTeamOptions = useMemo(
    () => (!affiliatedTeamIds ? teams : teams.filter((t) => affiliatedTeamIds.has(t.id) || t.id === values.home.teamId)),
    [teams, affiliatedTeamIds, values.home.teamId],
  )
  const awayTeamOptions = useMemo(
    () => (!affiliatedTeamIds ? teams : teams.filter((t) => affiliatedTeamIds.has(t.id) || t.id === values.away.teamId)),
    [teams, affiliatedTeamIds, values.away.teamId],
  )
  const narrowedByAffiliation = affiliatedTeamIds !== null

  const handleTextChange = (field: 'venue' | 'scoringUrl' | 'streamingUrl') => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const home = sidePayload(values.home)
    const away = sidePayload(values.away)
    const payload: MatchPayload = {
      homeTeamId: home.teamId,
      homeTeamName: home.teamName,
      homeTeamLogoUrl: home.teamLogoUrl,
      homeLeagueTeamId: home.leagueTeamId,
      awayTeamId: away.teamId,
      awayTeamName: away.teamName,
      awayTeamLogoUrl: away.teamLogoUrl,
      awayLeagueTeamId: away.leagueTeamId,
      leagueId: values.leagueId || null,
      seasonId: values.seasonId,
      matchDate: fromDatetimeLocal(values.matchDate),
      venue: values.venue.trim() ? values.venue.trim() : null,
      scoringUrl: values.scoringUrl.trim() ? values.scoringUrl.trim() : null,
      streamingUrl: values.streamingUrl.trim() ? values.streamingUrl.trim() : null,
    }
    onSubmit(payload)
  }

  return (
    <Box component="form" id={MATCH_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      <Input
        select
        label="Season"
        value={values.seasonId}
        onChange={(event) => changeScope({ seasonId: event.target.value })}
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
        onChange={(event) => changeScope({ leagueId: event.target.value })}
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

      <Input
        label="Scoring link"
        value={values.scoringUrl}
        onChange={handleTextChange('scoringUrl')}
        error={Boolean(errors.scoringUrl)}
        helperText={errors.scoringUrl ?? "Optional. Link to the match's scoring page, e.g. https://cricclubs.com/matches/34343"}
      />

      <Input
        label="Streaming link"
        value={values.streamingUrl}
        onChange={handleTextChange('streamingUrl')}
        error={Boolean(errors.streamingUrl)}
        helperText={
          errors.streamingUrl ?? 'Optional. Link to the live stream, e.g. a PitchVision page, starting with https://'
        }
      />

      {leagueTeamsNotice && (
        <Alert severity="info" sx={{ gridColumn: '1 / -1' }} onClose={() => setLeagueTeamsNotice(false)}>
          League or season changed, so the league team was cleared. Choose the team again.
        </Alert>
      )}

      <MatchSideFields
        label="Home"
        value={values.home}
        errors={{ team: errors.homeTeamId, name: errors.homeTeamName, leagueTeam: errors.homeLeagueTeamId }}
        onChange={(patch) => updateSide('home', patch)}
        teamOptions={homeTeamOptions}
        narrowedByAffiliation={narrowedByAffiliation}
        leagueTeams={leagueTeams}
        canUseLeagueTeams={canUseLeagueTeams}
        hasScope={hasScope}
        leagueId={values.leagueId}
        leagueTeamsLoading={leagueTeamsLoading}
      />

      <MatchSideFields
        label="Away"
        value={values.away}
        errors={{ team: errors.awayTeamId, name: errors.awayTeamName, leagueTeam: errors.awayLeagueTeamId }}
        onChange={(patch) => updateSide('away', patch)}
        teamOptions={awayTeamOptions}
        narrowedByAffiliation={narrowedByAffiliation}
        leagueTeams={leagueTeams}
        canUseLeagueTeams={canUseLeagueTeams}
        hasScope={hasScope}
        leagueId={values.leagueId}
        leagueTeamsLoading={leagueTeamsLoading}
      />
    </Box>
  )
}
