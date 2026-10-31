import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { listLeagueAffiliations } from '../../../api/leagueAffiliationApi'
import { listLeagues } from '../../../api/leagueApi'
import { leagueTeamsQueryKey, listLeagueTeams } from '../../../api/leagueTeamApi'
import { listMatches } from '../../../api/matchApi'
import { listPlayingAreas, playingAreasKey } from '../../../api/playingAreaApi'
import { listSeasons } from '../../../api/seasonApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { ImportWizardProps } from '../../../components/ImportWizard'
import { useReturnTo } from '../../../hooks/useReturnTo'
import type { ImportStepId } from '../../../components/ImportWizard'
import {
  leagueScheduleBackPath,
  leagueScheduleInvalidateKeys,
  tidyTeamName,
} from '../../../utils/leagueScheduleImport'
import type { LeagueScheduleOrigin } from '../../../utils/leagueScheduleImport'
import { normaliseOptions } from '../../../utils/importDecisions'
import type { ImportColumnOption, ImportColumnOptions } from '../../../utils/importDecisions'
import { ExtendLeagueDatesControl } from './ExtendLeagueDatesControl'
import { PossibleDuplicatesControl } from './PossibleDuplicatesControl'
import { SCOPE_MODE_HELP, SCOPE_MODE_LABELS, TEMPLATE_SCOPE_LABELS, describeScheduleChange, renderScheduleCandidate, scheduleCandidateBadge, scheduleConfirmLabel } from './scheduleCandidates'

// The wizard configuration the shared import consumer registry hands out for LEAGUE_SCHEDULE (docs/specs/098): everything the
// generic ImportWizard cannot know, as props. Used by the schedule page and by the resume page, so a resumed batch keeps its
// columns and wording.
export type ImportConsumerWizardProps = Omit<ImportWizardProps, 'clubId' | 'type' | 'scope' | 'batchId' | 'onBatchChange'>

const COLUMNS: NonNullable<ImportWizardProps['columns']> = [
  { id: 'date', header: 'Date', minWidth: 110 },
  { id: 'time', header: 'Start Time', minWidth: 84 },
  { id: 'home', header: 'Home team' },
  { id: 'away', header: 'Away team' },
  { id: 'venue', header: 'Venue' },
  { id: 'notes', header: 'Notes' },
]

const EDIT_LAYOUT: NonNullable<ImportWizardProps['editLayout']> = { primary: ['date', 'time', 'home', 'away', 'venue'], secondary: ['notes'], addSecondaryLabel: 'Add note', removeSecondaryLabel: 'Remove note', differentPair: ['home', 'away'] }

const OPTION_CAP = 300
const MATCH_SAMPLE = 200

// Distinct (case-insensitive) by label, an option with an identity beating a plain one (own team before league team when the same
// name is both), sorted A to Z, capped.
function distinctSorted(options: Array<string | ImportColumnOption | null | undefined>): ImportColumnOption[] {
  const usable = options.filter((option): option is string | ImportColumnOption => Boolean(option))
  return normaliseOptions(usable).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })).slice(0, OPTION_CAP)
}

// Venues stay plain strings.
function distinctNames(names: Array<string | null | undefined>): string[] {
  return distinctSorted(names).map((option) => option.label)
}

// Suggestions for the editable Check rows inputs (spec 125). Only fetched while Check rows is showing. Teams: only this league and
// season's own teams (those affiliated to the league and season; failing that our active teams already among the league's teams;
// failing that all our active teams) and its active league teams, so teams of other leagues never appear. A name typed freely is
// still accepted and handled by the team step. Venues: the club's fields in use and the venues on its latest matches.
function useScheduleColumnOptions(clubId: string, leagueId: string, seasonId: string, enabled: boolean, leagueTeamOptions: ImportColumnOption[]): ImportColumnOptions {
  const on = enabled && Boolean(clubId)
  const clubTeams = useQuery({ queryKey: ['managed-club', clubId, 'teams'], queryFn: () => listTeamsForClub(clubId), enabled: on, staleTime: 60_000 })
  const affiliations = useQuery({ queryKey: ['managed-club', clubId, 'leagues', leagueId, 'affiliations'], queryFn: () => listLeagueAffiliations(clubId, leagueId), enabled: on && Boolean(leagueId), staleTime: 60_000 })
  const matches = useQuery({ queryKey: ['managed-club', clubId, 'matches', 'import-suggestions'], queryFn: () => listMatches(clubId, { page: 0, size: MATCH_SAMPLE, sort: 'matchDate,desc' }), enabled: on, staleTime: 60_000 })
  const fields = useQuery({ queryKey: [...playingAreasKey(clubId), 'import-suggestions'], queryFn: () => listPlayingAreas(clubId, { size: MATCH_SAMPLE, usedByClub: true }), enabled: on, staleTime: 60_000 })
  return useMemo(() => {
    const matchRows = matches.data?.content ?? []
    const ownActive = (clubTeams.data ?? []).filter((team) => team.active)
    const affiliatedIds = new Set((affiliations.data ?? []).filter((affiliation) => affiliation.seasonId === seasonId).map((affiliation) => affiliation.teamId))
    const leagueNames = new Set(leagueTeamOptions.map((option) => option.label.toLowerCase()))
    const affiliated = ownActive.filter((team) => affiliatedIds.has(team.id))
    const inLeague = ownActive.filter((team) => leagueNames.has(team.name.trim().toLowerCase()))
    const own = affiliated.length > 0 ? affiliated : inLeague.length > 0 ? inLeague : ownActive
    // Own teams first so one that shares a name with a league team keeps its identity.
    const teams = distinctSorted([...own.map((team): ImportColumnOption => ({ label: team.name, kind: 'OWN_TEAM', id: team.id })), ...leagueTeamOptions])
    const venues = distinctNames([...(fields.data?.content ?? []).map((field) => field.name), ...matchRows.map((match) => match.venue)])
    return { home: teams, away: teams, venue: venues }
  }, [clubTeams.data, affiliations.data, matches.data, fields.data, leagueTeamOptions, seasonId])
}

// Null while the league and season names are still loading.
export function useLeagueScheduleWizardProps(clubId: string, params: Record<string, string>, options: { from?: LeagueScheduleOrigin } = {}): ImportConsumerWizardProps | null {
  const leagueId = params.leagueId ?? ''
  const seasonId = params.seasonId ?? ''
  // docs/specs/127: a returnTo in the address wins; otherwise the legacy ?from= (options.from) picks the schedule or the edit tab.
  const origin = useReturnTo()
  const leaguesQuery = useQuery({ queryKey: ['managed-club', clubId, 'leagues', 'list', { includeInactive: true }], queryFn: () => listLeagues(clubId, { includeInactive: true }), enabled: Boolean(clubId) })
  const seasonsQuery = useQuery({ queryKey: ['managed-club', clubId, 'seasons'], queryFn: () => listSeasons(clubId), enabled: Boolean(clubId) })
  const teamsQuery = useQuery({ queryKey: leagueTeamsQueryKey(clubId, leagueId, seasonId), queryFn: () => listLeagueTeams(clubId, leagueId, seasonId), enabled: Boolean(clubId) && Boolean(leagueId) && Boolean(seasonId) })

  const [step, setStep] = useState<ImportStepId>('upload')
  const leagueTeamOptions = useMemo(() => (teamsQuery.data ?? []).filter((team) => team.active).map((team): ImportColumnOption => ({ label: team.name, kind: 'LEAGUE_TEAM', id: team.id })), [teamsQuery.data])
  const columnOptions = useScheduleColumnOptions(clubId, leagueId, seasonId, step === 'rows', leagueTeamOptions)

  if (leaguesQuery.isPending || seasonsQuery.isPending) return null
  const league = leaguesQuery.data?.find((candidate) => candidate.id === leagueId)
  const season = seasonsQuery.data?.find((candidate) => candidate.id === seasonId)
  const scopeLabel = [league?.name ?? 'League', season?.label].filter(Boolean).join(', ')

  return {
    title: 'Import schedule',
    scopeLabel,
    backTo: origin ? origin.to : leagueScheduleBackPath(leagueId, seasonId || null, options.from ?? 'edit'),
    backLabel: origin ? (origin.label ? `Back to ${origin.label}` : 'Back') : 'Back to the schedule',
    columns: COLUMNS,
    columnOptions,
    editLayout: EDIT_LAYOUT,
    onStepChange: setStep,
    renderProposalExtras: renderScheduleCandidate,
    candidateBadge: scheduleCandidateBadge,
    describeChange: describeScheduleChange,
    confirmLabelFor: (batch) => scheduleConfirmLabel(batch.plannedChanges),
    resultLinks: [{ label: 'View schedule', to: `/manage/fixtures/leagues/${leagueId}/schedule${seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : ''}` }],
    invalidateKeys: leagueScheduleInvalidateKeys(clubId, leagueId, seasonId),
    checkSettings: (state) => (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <ExtendLeagueDatesControl {...state} />
        <PossibleDuplicatesControl {...state} />
      </Box>
    ),
    createOptions: { tidyName: tidyTeamName, withAbbreviation: true, existingNames: (teamsQuery.data ?? []).map((team) => team.name) },
    collapseLowCandidates: true,
    labels: {
      rowsStep: 'Check',
      identifyStep: 'Our teams',
      resolveStep: 'Teams',
      reportStep: 'Done',
      identifyDescription: 'Tick which of the names in the file are your teams and pick the club team each one is. Only matches that involve them are imported.',
      noun: 'teams',
      pendingRowsLabel: 'Needs a team',
      pendingLinkedLabel: (name) => `Team matched: ${name}`,
      pendingUnmatchedLabel: 'Pick the team',
      pendingCreatedLabel: 'Team to be added',
      startBlankLabel: 'Start with an empty schedule',
      emptyRowsLabel: 'No rows yet. Add the first match.',
      entityLabels: { MATCH: 'Matches', LEAGUE_TEAM: 'League teams' },
      templateScopeLabels: TEMPLATE_SCOPE_LABELS,
      scopeModeLabels: SCOPE_MODE_LABELS,
      scopeModeHelp: SCOPE_MODE_HELP,
    },
  }
}
