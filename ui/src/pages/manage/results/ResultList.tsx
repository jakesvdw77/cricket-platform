import { useEffect, useMemo, useState } from 'react'
import { Box, Link, Stack, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AddCard } from '../../../components/AddCard'
import { BrandIcon } from '../../../components/BrandIcon'
import { Button } from '../../../components/Button'
import { SplitButton } from '../../../components/SplitButton'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { SortMenu } from '../../../components/ContentControlsLine'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { ToolbarCard, ToolbarSortButton } from '../../../components/ToolbarCard'
import { FilterBar } from '../../../components/FilterBar'
import { HeaderSeasonSelect } from '../../../components/HeaderSeasonSelect'
import { ListViewToggle } from '../../../components/ListViewToggle'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { PageCounters } from '../../../components/PageCounters'
import { ShareResultDialog } from '../../../components/ShareResultDialog'
import type { PageCounterItem } from '../../../components/PageCounters'
import {
  getResultsSummary,
  listResultFilterOptions,
  listResults,
  resultKeys,
} from '../../../api/matchResultApi'
import type {
  ResultFilters,
  ResultListItem,
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
import { dynamicCardGridSx } from '../../../utils/cardGrid'
import { CaptureResultDialog } from './CaptureResultDialog'
import { ResultRowMenu } from './ResultRowMenu'
import { resultImportTo, resultTitle } from './resultListHelpers'
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
  'tied-or-none': 'Tied / No Result',
  drafts: 'Drafts',
}

const OUTCOME_OPTIONS: { value: ResultOutcomeType; label: string }[] = [
  { value: 'WON', label: 'Won' },
  { value: 'TIE', label: 'Tie' },
  { value: 'DRAW', label: 'Draw' },
  { value: 'NO_RESULT', label: 'No Result' },
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
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // docs/specs/138: the sort and the counters' quick filter live in the address, so Back from a result restores them.
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') === 'asc' ? SORT_ASC : SORT_DESC
  const focusParam = params.get('focus')
  const focus = (Object.keys(FOCUS_LABELS) as ResultListFocus[]).find((key) => key === focusParam) ?? null
  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const setSort = (next: string) => setParam('sort', next === SORT_ASC ? 'asc' : null)
  const setFocus = (next: ResultListFocus | null) => setParam('focus', next)
  // Section, League and Season are saved per club; Team, Outcome, Status and the counters' quick filter are per visit.
  const [{ sectionId, leagueId, seasonId }, setSaved] = usePersistedListFilters(`resultList:filters:${clubId}`, {
    sectionId: null as string | null,
    leagueId: null as string | null,
    seasonId: null as string | null,
  })
  const [teamId, setTeamId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<ResultOutcomeType | null>(null)
  const [status, setStatus] = useState<ResultStatus | null>(null)
  const [view, setView] = useListViewPreference('resultList:view')
  const [pickerOpen, setPickerOpen] = useState(false)
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  // docs/specs/114: the result whose Share dialog is open.
  const [shareItem, setShareItem] = useState<ResultListItem | null>(null)

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
  // Choosing the active counter again turns its filter off; choosing another replaces it.
  const toggleFocus = (next: ResultListFocus) => setFocus(focus === next ? null : next)
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
          label: 'Awaiting Result',
          shortLabel: 'Awaiting',
          tone: summary.awaiting > 0 ? 'warning' : 'default',
          kind: 'drill',
          hint: 'Pick a match',
          onSelect: () => setPickerOpen(true),
        },
      ]
    : []
  const showCounters = !summaryQuery.isError && (summaryQuery.isPending || Boolean(summary))
  const awaitingCount = summary?.awaiting ?? 0
  const sortOptions = [
    { value: SORT_DESC, label: 'Latest First', linkLabel: 'Latest First' },
    { value: SORT_ASC, label: 'Oldest First', linkLabel: 'Oldest First' },
  ]
  const openCreate = () => setPickerOpen(true)

  // docs/specs/138 and page-anatomy section 3: one flat toolbar, desktop order: the shared filters (League, Section, Team, Outcome, Status),
  // search, then Sort, then Cards | List last. A phone: Filters and search on the row, the toggle then the quick filter and Sort in the sheet.
  const bar = (
    <FilterBar
      bare
      inCard
      viewControlsInline
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
          allLabel: 'All Outcomes',
          options: OUTCOME_OPTIONS,
          value: outcome ?? '',
          onChange: (value: string) => setOutcome((value || null) as ResultOutcomeType | null),
        },
        {
          key: 'status',
          label: 'Status',
          allLabel: 'All Statuses',
          options: STATUS_OPTIONS,
          value: status ?? '',
          onChange: (value: string) => setStatus((value || null) as ResultStatus | null),
        },
      ]}
      searchPlaceholder="Search by opponent or team name"
      searchOptions={searchSuggestions}
      extraChips={focus ? [{ key: 'focus', label: FOCUS_LABELS[focus], onRemove: () => setFocus(null) }] : []}
      viewControls={
        phone ? (
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
            <SortMenu value={sort} options={sortOptions} onChange={setSort} />
          </>
        ) : (
          <>
            <ToolbarSortButton value={sort} onChange={setSort} options={sortOptions.map(({ value, label }) => ({ value, label }))} />
            <ListViewToggle value={view} onChange={setView} variant="toolbar" />
          </>
        )
      }
      onClearAll={() => {
        setSaved({ leagueId: null, sectionId: null })
        setTeamId(null)
        setOutcome(null)
        setStatus(null)
        setFocus(null)
      }}
    />
  )

  // Empty states (page-anatomy section 5): the section's icon, and one text link to create a result only where nothing exists yet; a
  // filtered or searched-out list has no link, because adding is not the fix.
  const emptyState = hasResults ? null : isSearching ? (
    <EmptyState icon={<BrandIcon name="nav/result-scorecard" size={48} padding={4} />} title="No matching results" description={`No results match "${debouncedSearch}". Try a different search.`} />
  ) : hasFilters ? (
    <EmptyState icon={<BrandIcon name="nav/result-scorecard" size={48} padding={4} />} title="No results match these filters" description="Try clearing a filter or choosing another counter." />
  ) : (
    <EmptyState
      icon={<BrandIcon name="nav/result-scorecard" size={48} padding={4} />}
      title="No results yet"
      description={
        awaitingCount > 0
          ? `${awaitingCount} ${awaitingCount === 1 ? 'match is' : 'matches are'} waiting for a result.`
          : 'Results you capture for your matches will appear here.'
      }
      action={<EmptyStateLink onClick={openCreate}>Capture New Result</EmptyStateLink>}
    />
  )
  // List view: the bar is fused into the table's card in every state. Cards view: a standalone toolbar card.
  const fused = view === 'list'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ManageScreenHeader
        title="Results"
        titleAdornment={
          <HeaderSeasonSelect
            seasons={filterableSeasons.map((season) => ({ id: season.id, name: season.label }))}
            value={seasonId}
            onChange={(next) => setSaved({ seasonId: next })}
          />
        }
        // ONE filled button on the title row (page-anatomy section 1). It opens the capture picker, which also offers Import (docs/specs/104).
        action={
          <SplitButton
            label="Capture New Result"
            onClick={openCreate}
            testId="capture-result"
            items={[
              { id: 'import', label: 'Import Result', icon: <UploadFileOutlinedIcon fontSize="small" />, onClick: () => navigate(resultImportTo()) },
            ]}
          />
        }
      />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      {!fused && <ToolbarCard>{bar}</ToolbarCard>}

      {fused && (
        <ResultTable
          items={data.content}
          teamsById={teamsById}
          toolbar={bar}
          empty={emptyState}
          renderActions={(item) => (
            <ResultRowMenu item={item} title={resultTitle(item, teamsById)} onPublish={(picked) => publish(picked.match.id)} onShare={setShareItem} />
          )}
        />
      )}

      {!fused && emptyState}

      {!fused && hasResults && (
        <Box sx={dynamicCardGridSx}>
          {data.content.map((item) => (
            <ResultCard
              key={item.match.id}
              item={item}
              teamsById={teamsById}
              leaguesById={leaguesById}
              seasonsById={seasonsById}
              onPublish={(picked) => publish(picked.match.id)}
              onShare={setShareItem}
            />
          ))}
          {/* The grid ends with a dashed Create card (same action as the title-row button); with no cards it is not shown (the empty message carries the link). */}
          <AddCard label="Capture New Result" onClick={openCreate} testId="add-result-card" />
        </Box>
      )}

      {hasResults && data.totalPages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
          <Button size="compact" variant="secondary" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
            Previous
          </Button>
          <Typography variant="body2" color="text.secondary">
            Page {data.number + 1} of {data.totalPages}
          </Typography>
          <Button size="compact" variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => setPage((prev) => prev + 1)}>
            Next
          </Button>
        </Stack>
      )}

      {dialogs}
      {shareItem && (
        <ShareResultDialog
          open
          onClose={() => setShareItem(null)}
          clubId={clubId}
          match={shareItem.match}
          result={shareItem.result}
          teamsById={teamsById}
        />
      )}
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
