import { useEffect, useMemo, useState } from 'react'
import { Box, Link, Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BrandIcon } from '../../../components/BrandIcon'
import { Button } from '../../../components/Button'
import { ContentControlsLine, SortLink } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { HeaderSeasonSelect } from '../../../components/HeaderSeasonSelect'
import { ListViewToggle } from '../../../components/ListViewToggle'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import {
  getResultsSummary,
  listResultFilterOptions,
  listResults,
  resultKeys,
} from '../../../api/matchResultApi'
import type {
  ResultFilters,
  ResultListFocus,
  ResultOutcomeType,
  ResultStatus,
} from '../../../api/matchResultApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listLeagues } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'
import { listSeasons } from '../../../api/seasonApi'
import type { Season } from '../../../api/seasonApi'
import { listSections } from '../../../api/sectionApi'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { scopeFilterText } from '../../../utils/availabilityScope'
import { cardGridSx } from '../../../utils/cardGrid'
import { CaptureResultDialog } from './CaptureResultDialog'
import { resultImportTo } from './resultListHelpers'
import { ResultCard } from './ResultCard'
import { ResultTable } from './ResultTable'
import { usePublishResult } from './usePublishResult'

const SEARCH_DEBOUNCE_MS = 300

const SORT_DESC = 'matchDate,desc'
const SORT_ASC = 'matchDate,asc'

// docs/specs/100-match-results-core.md: the quick filters behind the counters, named as the chip, the scope text and the
// phone sheet's Quick filter row show them.
const FOCUS_LABELS: Record<ResultListFocus, string> = {
  played: 'Played',
  won: 'Won',
  lost: 'Lost',
  'tied-or-none': 'Tied / no result',
  drafts: 'Drafts',
}

const OUTCOME_OPTIONS: { value: ResultOutcomeType; label: string }[] = [
  { value: 'WON', label: 'Won' },
  { value: 'TIE', label: 'Tie' },
  { value: 'DRAW', label: 'Draw' },
  { value: 'NO_RESULT', label: 'No result' },
  { value: 'ABANDONED', label: 'Abandoned' },
  { value: 'FORFEIT', label: 'Forfeit' },
]

const STATUS_OPTIONS: { value: ResultStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
]

// docs/specs/100-match-results-core.md: the Results page, the Matches page's sibling (docs/specs/087, 089): Season pill,
// counters, FilterBar (plus Outcome and Status), content line, then result cards or the list view. Every filter is a
// backend parameter; the counters come from GET /results/summary for the same filters.
export default function ResultList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState(SORT_DESC)
  // Section, League and Season are saved per club; Team, Outcome, Status and the counters' quick filter are per visit.
  const [{ sectionId, leagueId, seasonId }, setSaved] = usePersistedListFilters(`resultList:filters:${clubId}`, {
    sectionId: null as string | null,
    leagueId: null as string | null,
    seasonId: null as string | null,
  })
  const [teamId, setTeamId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<ResultOutcomeType | null>(null)
  const [status, setStatus] = useState<ResultStatus | null>(null)
  const [focus, setFocus] = useState<ResultListFocus | null>(null)
  const [view, setView] = useListViewPreference('resultList:view')
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, sort, sectionId, leagueId, seasonId, teamId, outcome, status, focus])

  const filters: ResultFilters = {
    sectionId: sectionId ?? undefined,
    leagueId: leagueId ?? undefined,
    seasonId: seasonId ?? undefined,
    teamId: teamId ?? undefined,
    search: debouncedSearch || undefined,
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: resultKeys.list(clubId ?? '', {
      page,
      sort,
      ...filters,
      ...(outcome ? { outcome: [outcome] } : {}),
      ...(status ? { status } : {}),
      ...(focus ? { focus } : {}),
    }),
    queryFn: () =>
      listResults(clubId as string, {
        page,
        sort,
        ...filters,
        ...(outcome ? { outcome: [outcome] } : {}),
        ...(status ? { status } : {}),
        ...(focus ? { focus } : {}),
      }),
    enabled: Boolean(clubId),
    // Keep the previous page on screen while a filter or counter change loads, so the toolbar and counters stay mounted.
    placeholderData: keepPreviousData,
  })

  const { data: teams } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })
  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })
  const { data: leagues } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
  })
  const { data: seasons } = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  // Which section/league/season/team ids are reachable for the current filters (each ignoring its own pick).
  const filterOptionsQuery = useQuery({
    queryKey: resultKeys.filterOptions(clubId ?? '', filters),
    queryFn: () => listResultFilterOptions(clubId as string, filters),
    enabled: Boolean(clubId),
  })

  // The counters for exactly the filters the list sends (the quick filter, Outcome and Status do not narrow them). A
  // failed request hides the row; the list still works.
  const summaryQuery = useQuery({
    queryKey: resultKeys.summary(clubId ?? '', filters),
    queryFn: () => getResultsSummary(clubId as string, filters),
    enabled: Boolean(clubId),
    retry: false,
    placeholderData: keepPreviousData,
  })

  const { publish, dialogs } = usePublishResult(clubId ?? '')

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teams ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teams])
  const leaguesById = useMemo(() => {
    const map = new Map<string, League>()
    ;(leagues ?? []).forEach((league) => map.set(league.id, league))
    return map
  }, [leagues])
  const seasonsById = useMemo(() => {
    const map = new Map<string, Season>()
    ;(seasons ?? []).forEach((season) => map.set(season.id, season))
    return map
  }, [seasons])

  const options = filterOptionsQuery.data
  const filterableSections = useMemo(
    () => (sections ?? []).filter((section) => !options || options.sectionIds.includes(section.id)),
    [sections, options],
  )
  const filterableLeagues = useMemo(
    () => (leagues ?? []).filter((league) => !options || options.leagueIds.includes(league.id)),
    [leagues, options],
  )
  const filterableSeasons = useMemo(
    () => (seasons ?? []).filter((season) => !options || options.seasonIds.includes(season.id)),
    [seasons, options],
  )
  const filterableTeams = useMemo(
    () =>
      Array.from(teamsById.values())
        .filter((team) => !options || options.teamIds.includes(team.id))
        .map((team) => ({ id: team.id, name: team.name })),
    [teamsById, options],
  )
  const searchSuggestions = useMemo(() => {
    const term = search.trim().toLowerCase()
    const names = filterableTeams.map((team) => team.name)
    return term ? names.filter((name) => name.toLowerCase().includes(term)) : names
  }, [search, filterableTeams])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Couldn't load results"
        description="Something went wrong loading your club's results. Please try again."
      />
    )
  }

  const hasResults = data.content.length > 0
  const isSearching = debouncedSearch.length > 0
  const hasFilters = Boolean(sectionId || leagueId || teamId || outcome || status || focus)
  const seasonLabel = seasonId ? seasonsById.get(seasonId)?.label : undefined
  const scope = [
    scopeFilterText({ sections: sections ?? [], sectionId, leagues: leagues ?? [], leagueId, teams: filterableTeams, teamId }),
    seasonLabel,
  ]
    .filter(Boolean)
    .join(' · ')
  // Choosing the active counter again turns its filter off; choosing another replaces it.
  const toggleFocus = (next: ResultListFocus) => setFocus((current) => (current === next ? null : next))
  const summary = summaryQuery.data
  const filterCounter = (id: ResultListFocus, value: number, extra: Partial<PageCounterItem> = {}): PageCounterItem => ({
    id,
    value,
    label: FOCUS_LABELS[id],
    kind: 'filter',
    active: focus === id,
    hint: 'Tap to filter',
    onSelect: () => toggleFocus(id),
    ...extra,
  })
  const counters: PageCounterItem[] = summary
    ? [
        filterCounter('played', summary.played),
        filterCounter('won', summary.won),
        filterCounter('lost', summary.lost),
        filterCounter('tied-or-none', summary.tiedOrNone, { shortLabel: 'Tied / none' }),
        filterCounter('drafts', summary.drafts, { tone: summary.drafts > 0 ? 'warning' : 'default' }),
        // Opens the capture picker rather than filtering the list below.
        {
          id: 'awaiting',
          value: summary.awaiting,
          label: 'Awaiting result',
          shortLabel: 'Awaiting',
          tone: summary.awaiting > 0 ? 'warning' : 'default',
          kind: 'drill',
          hint: 'Pick a match',
          onSelect: () => setPickerOpen(true),
        },
      ]
    : []
  const showCounters = !summaryQuery.isError && (summaryQuery.isPending || Boolean(summary))
  const sortLink = (
    <SortLink
      label={sort === SORT_DESC ? 'latest first' : 'oldest first'}
      onToggle={() => setSort(sort === SORT_DESC ? SORT_ASC : SORT_DESC)}
    />
  )
  const awaitingCount = summary?.awaiting ?? 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Results"
        subtitle={scope ? `Showing: ${scope}` : undefined}
        titleAdornment={
          <HeaderSeasonSelect
            seasons={filterableSeasons.map((season) => ({ id: season.id, name: season.label }))}
            value={seasonId}
            onChange={(next) => setSaved({ seasonId: next })}
          />
        }
        action={
          // docs/specs/104: Import result sits beside Capture result; the capture picker also offers it.
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => navigate(resultImportTo())}>
              Import result
            </Button>
            <Button onClick={() => setPickerOpen(true)}>Capture result</Button>
          </Box>
        }
      />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <FilterBar
        density="compact"
        leagues={filterableLeagues}
        sections={filterableSections}
        teams={filterableTeams}
        leagueId={leagueId}
        sectionId={sectionId}
        teamId={teamId}
        onLeagueChange={(next) => setSaved({ leagueId: next })}
        onSectionChange={(next) => setSaved({ sectionId: next })}
        onTeamChange={setTeamId}
        searchValue={search}
        onSearchChange={setSearch}
        extraSelects={[
          {
            key: 'outcome',
            label: 'Outcome',
            allLabel: 'All outcomes',
            options: OUTCOME_OPTIONS,
            value: outcome ?? '',
            onChange: (value: string) => setOutcome((value || null) as ResultOutcomeType | null),
          },
          {
            key: 'status',
            label: 'Status',
            allLabel: 'All statuses',
            options: STATUS_OPTIONS,
            value: status ?? '',
            onChange: (value: string) => setStatus((value || null) as ResultStatus | null),
          },
        ]}
        searchPlaceholder="Search by opponent or team name"
        searchOptions={searchSuggestions}
        extraChips={focus ? [{ key: 'focus', label: FOCUS_LABELS[focus], onRemove: () => setFocus(null) }] : []}
        viewControls={
          <>
            <Box sx={{ width: '100%' }}>
              <ListViewToggle value={view} onChange={setView} fullWidth />
            </Box>
            {focus && (
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 36 }}>
                <Typography variant="body2" color="text.secondary">
                  Quick filter: <b>{FOCUS_LABELS[focus]}</b>
                </Typography>
                <Link component="button" type="button" underline="hover" onClick={() => setFocus(null)} sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                  Clear
                </Link>
              </Box>
            )}
            {sortLink}
          </>
        }
        onClearAll={() => {
          setSaved({ leagueId: null, sectionId: null })
          setTeamId(null)
          setOutcome(null)
          setStatus(null)
          setFocus(null)
        }}
      />

      <ContentControlsLine
        scope={`Showing ${data.totalElements} ${data.totalElements === 1 ? 'result' : 'results'}${focus ? ` · ${FOCUS_LABELS[focus]}` : ''}`}
        sortAction={sortLink}
        controls={<ListViewToggle value={view} onChange={setView} />}
      />

      {hasResults && view === 'list' && <ResultTable items={data.content} teamsById={teamsById} />}

      {hasResults && view === 'cards' && (
        <Box sx={cardGridSx}>
          {data.content.map((item) => (
            <ResultCard
              key={item.match.id}
              item={item}
              teamsById={teamsById}
              leaguesById={leaguesById}
              seasonsById={seasonsById}
              onPublish={(picked) => publish(picked.match.id)}
            />
          ))}
        </Box>
      )}

      {!hasResults && isSearching && (
        <EmptyState
          title="No matching results"
          description={`No results match "${debouncedSearch}". Try a different search.`}
        />
      )}

      {!hasResults && !isSearching && hasFilters && (
        <EmptyState
          title="No results match these filters"
          description="Try clearing a filter or choosing another counter."
        />
      )}

      {!hasResults && !isSearching && !hasFilters && (
        <EmptyState
          icon={<BrandIcon name="nav/result-scorecard" size={48} padding={4} />}
          title="No results yet"
          description={
            awaitingCount > 0
              ? `${awaitingCount} ${awaitingCount === 1 ? 'match is' : 'matches are'} waiting for a result.`
              : 'Results you capture for your matches will appear here.'
          }
          action={
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => navigate(resultImportTo())}>
                Import result
              </Button>
              <Button onClick={() => setPickerOpen(true)}>Capture result</Button>
            </Box>
          }
        />
      )}

      {hasResults && data.totalPages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
            Previous
          </Button>
          <Typography variant="body2" color="text.secondary">
            Page {data.number + 1} of {data.totalPages}
          </Typography>
          <Button
            variant="secondary"
            size="sm"
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </Stack>
      )}

      {dialogs}
      <CaptureResultDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        clubId={clubId}
        teamsById={teamsById}
        leaguesById={leaguesById}
      />
    </Box>
  )
}
