import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Alert, Box, MenuItem, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { FormSectionHeading } from '../FormSectionHeading'
import { FieldPicker } from '../FieldPicker'
import type { FieldPickerValue } from '../FieldPicker'
import { Input } from '../Input'
import { DateTimeField } from '../DateTimeField'
import { MatchSideFields } from './MatchSideFields'
import type { SideMode, SideState } from './MatchSideFields'
import type { MatchPayload } from '../../api/matchApi'
import { fromDatetimeLocal, toDatetimeLocal } from '../../utils/datetimeLocal'
import type { Season } from '../../api/seasonApi'
import type { League } from '../../api/leagueApi'
import type { Team } from '../../api/teamApi'
import type { Section } from '../../api/sectionApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'
import type { LeagueTeam } from '../../api/leagueTeamApi'
import { getLeagueSeasonDates, leagueSeasonDatesKey } from '../../api/leagueSeasonDatesApi'
import type { LeagueSeasonDates } from '../../api/leagueSeasonDatesApi'
import { formatReferenceDate } from '../../utils/ageCutoff'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see MatchFormPage), same pattern as LEAGUE_FORM_ID/SEASON_FORM_ID.
export const MATCH_FORM_ID = 'match-form'

export interface MatchFormProps {
  // docs/specs/099-fields-directory.md: the club whose fields the Field box searches (home fields first).
  clubId: string
  initialValues?: Partial<MatchPayload>
  // The field the match already has (its id, name and verification state), shown in the Field box. A match with only the
  // old free-text venue has none, and that text is shown beneath the box until a field is chosen.
  initialField?: FieldPickerValue | null
  // The current club's own teams only — cross-club Team references stay backend-supported (any
  // club's Team id is a valid homeTeamId/awayTeamId) but this pass's UI only ever lets an admin
  // pick from their own club's teams (docs/specs/029-league-management.md's Rollout Notes).
  teams: Team[]
  // The club's sections, to show each team's section in the picker (optional).
  sections?: Section[]
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
  // docs/specs/111: the server's refusal of a date outside the league's dates, shown under the date field until the date is
  // changed. The league's dates themselves are looked up here once a league and season are chosen.
  matchDateServerError?: string | null
}

interface FormState {
  home: SideState
  away: SideState
  leagueId: string
  seasonId: string
  matchDate: string
  field: FieldPickerValue | null
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
    | 'field'
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

function toFormState(initialValues?: Partial<MatchPayload>, initialField?: FieldPickerValue | null): FormState {
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
    field: initialField ?? null,
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

// docs/specs/111: "This league runs from 1 Sep 2026 to 31 Jul 2027." (the same wording the server uses).
function leagueDatesMessage(range: LeagueSeasonDates): string {
  return `This league runs from ${formatReferenceDate(range.startDate)} to ${formatReferenceDate(range.endDate)}.`
}

// The entered local date is outside the range (yyyy-MM-dd compares as text); a blank date is not "outside".
function isOutsideRange(matchDate: string, range: LeagueSeasonDates | null): boolean {
  const day = matchDate.slice(0, 10)
  return Boolean(range && day && (day < range.startDate || day > range.endDate))
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
  // docs/specs/099: a rejected field already on the match blocks Save until another field is chosen or the box is cleared.
  if (values.field?.verificationStatus === 'REJECTED') {
    errors.field = 'This field was rejected. Choose another field or clear this one.'
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
  clubId,
  initialValues,
  initialField,
  teams,
  sections = [],
  seasons,
  leagues,
  affiliations,
  leagueTeams = [],
  leagueTeamsLoading = false,
  canUseLeagueTeams = false,
  onScopeChange,
  onSubmit,
  matchDateServerError = null,
}: MatchFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues, initialField))
  const [errors, setErrors] = useState<FormErrors>({})
  const [leagueTeamsNotice, setLeagueTeamsNotice] = useState(false)
  // Text from before fields existed (a match with a venue but no field): kept as it is, and shown read-only under the
  // Field box until a field is chosen. Clearing a field that was chosen clears the venue with it.
  const legacyVenue = initialField ? '' : (initialValues?.venue ?? '').trim()

  const hasScope = Boolean(values.leagueId && values.seasonId)

  // docs/specs/111: the league's dates in the chosen season, looked up only once both are chosen. No dates, or a failed
  // lookup, leaves the date field unrestricted (the server still checks).
  const datesQuery = useQuery({
    queryKey: leagueSeasonDatesKey(clubId, values.leagueId, values.seasonId),
    queryFn: () => getLeagueSeasonDates(clubId, values.leagueId, values.seasonId),
    enabled: hasScope,
    retry: false,
  })
  const leagueDates = hasScope ? (datesQuery.data ?? null) : null

  // Shown as soon as the chosen date is outside the range, and it blocks the submit.
  const dateOutsideLeague = leagueDates !== null && isOutsideRange(values.matchDate, leagueDates)
  const leagueRangeMessage = dateOutsideLeague && leagueDates ? leagueDatesMessage(leagueDates) : undefined

  // A refusal from the server stays under the date until the date is edited; a fresh submit (which clears the prop) re-arms it.
  const [dismissedServerError, setDismissedServerError] = useState<string | null>(null)
  if (!matchDateServerError && dismissedServerError) {
    setDismissedServerError(null)
  }
  const serverDateError = matchDateServerError && matchDateServerError !== dismissedServerError ? matchDateServerError : null

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

  const handleTextChange = (field: 'scoringUrl' | 'streamingUrl') => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0 || dateOutsideLeague) {
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
      // Choosing a field sends its id and the server writes the venue from its name; with no field the venue is the old text.
      playingAreaId: values.field ? values.field.id : null,
      venue: values.field ? values.field.name : legacyVenue || null,
      scoringUrl: values.scoringUrl.trim() ? values.scoringUrl.trim() : null,
      streamingUrl: values.streamingUrl.trim() ? values.streamingUrl.trim() : null,
    }
    onSubmit(payload)
  }

  return (
    <Box component="form" id={MATCH_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      {/* docs/specs/089 (B): one full-width block - "Match details" over a three-column grid, then "Teams" over the two
          side panels, so a new match fits one desktop screen. Helper text is gone: "(optional)" sits in the label and
          the URL examples are placeholders; validation errors still show under the field. */}
      <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormSectionHeading icon={<InfoOutlinedIcon />} title="Match details" />
        <Box sx={{ display: 'grid', gap: { xs: 2, md: 2 }, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
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
            label="League (optional)"
            value={values.leagueId}
            onChange={(event) => changeScope({ leagueId: event.target.value })}
          >
            <MenuItem value="">None (friendly)</MenuItem>
            {leagues.map((league) => (
              <MenuItem key={league.id} value={league.id}>
                {league.name}
              </MenuItem>
            ))}
          </Input>

          <DateTimeField
            label="Match date & time"
            value={values.matchDate}
            onChange={(matchDate) => {
              setValues((prev) => ({ ...prev, matchDate }))
              if (matchDateServerError) setDismissedServerError(matchDateServerError)
            }}
            min={leagueDates?.startDate}
            max={leagueDates?.endDate}
            error={Boolean(errors.matchDate || leagueRangeMessage || serverDateError)}
            helperText={errors.matchDate ?? leagueRangeMessage ?? serverDateError ?? undefined}
          />

          <Box>
            <FieldPicker
              clubId={clubId}
              value={values.field}
              onChange={(field) => setValues((prev) => ({ ...prev, field }))}
              error={Boolean(errors.field)}
              helperText={errors.field}
            />
            {legacyVenue && !values.field && (
              <Typography variant="caption" color="text.secondary" component="p" data-testid="legacy-venue" sx={{ mt: 0.5, mb: 0, ml: 1.75 }}>
                Current venue: {legacyVenue}
              </Typography>
            )}
          </Box>

          <Input
            label="Scoring link (optional)"
            placeholder="https://cricclubs.com/matches/34343"
            value={values.scoringUrl}
            onChange={handleTextChange('scoringUrl')}
            error={Boolean(errors.scoringUrl)}
            helperText={errors.scoringUrl}
            InputLabelProps={{ shrink: true }}
          />

          <Input
            label="Streaming link (optional)"
            placeholder="https://"
            value={values.streamingUrl}
            onChange={handleTextChange('streamingUrl')}
            error={Boolean(errors.streamingUrl)}
            helperText={errors.streamingUrl}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        {values.field?.verificationStatus === 'UNVERIFIED' && (
          <Alert severity="warning" data-testid="field-unverified-alert">
            <b>This field has not been verified yet.</b> The address may be wrong.
          </Alert>
        )}
        {values.field?.verificationStatus === 'REJECTED' && (
          <Alert severity="error" data-testid="field-rejected-alert">
            <b>This field was rejected by an administrator.</b> Choose another field, or clear this one, before saving.
          </Alert>
        )}

        {leagueTeamsNotice && (
          <Alert severity="info" onClose={() => setLeagueTeamsNotice(false)}>
            League or season changed, so the league team was cleared. Choose the team again.
          </Alert>
        )}

        <FormSectionHeading icon={<SportsCricketOutlinedIcon />} title="Teams" />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
          <MatchSideFields
            label="Home"
            value={values.home}
            errors={{ team: errors.homeTeamId, name: errors.homeTeamName, leagueTeam: errors.homeLeagueTeamId }}
            onChange={(patch) => updateSide('home', patch)}
            teamOptions={homeTeamOptions}
            sections={sections}
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
            sections={sections}
            narrowedByAffiliation={narrowedByAffiliation}
            leagueTeams={leagueTeams}
            canUseLeagueTeams={canUseLeagueTeams}
            hasScope={hasScope}
            leagueId={values.leagueId}
            leagueTeamsLoading={leagueTeamsLoading}
          />
        </Box>

        {canUseLeagueTeams && !hasScope && (
          <Typography variant="caption" color="text.secondary">
            Choose a league and season first to pick a league team.
          </Typography>
        )}
      </Box>
    </Box>
  )
}
