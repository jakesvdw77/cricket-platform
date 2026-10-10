import { useMemo, useState } from 'react'
import { Box, Link, Typography } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { CompactSwitch } from '../../components/CompactSwitch'
import { ContentControlsLine, SortMenu } from '../../components/ContentControlsLine'
import type { SortMenuOption } from '../../components/ContentControlsLine'
import { EmptyState } from '../../components/EmptyState'
import { FilterBar } from '../../components/FilterBar'
import { ListViewToggle } from '../../components/ListViewToggle'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { PageCounters } from '../../components/PageCounters'
import type { PageCounterItem } from '../../components/PageCounters'
import { getSeasonsSummary, listSeasons, seasonsSummaryKey } from '../../api/seasonApi'
import type { Season, SeasonSummary } from '../../api/seasonApi'
import { useListViewPreference } from '../../hooks/useListViewPreference'
import { cardGridSx } from '../../utils/cardGrid'
import { matchesSeasonFocus, seasonCounters } from '../../utils/seasonCounters'
import type { SeasonFocus } from '../../utils/seasonCounters'
import { localToday } from '../../utils/seasonStatus'
import { SeasonCard } from './seasons/SeasonCard'
import { SeasonTable } from './seasons/SeasonTable'

type SeasonSort = 'newest' | 'oldest' | 'name'

const SORT_OPTIONS: (SortMenuOption & { value: SeasonSort })[] = [
  { value: 'newest', label: 'Newest first', linkLabel: 'newest first' },
  { value: 'oldest', label: 'Oldest first', linkLabel: 'oldest first' },
  { value: 'name', label: 'Name, A to Z', linkLabel: 'A to Z' },
]

const FOCUS_LABELS: Record<SeasonFocus, string> = {
  current: 'Current',
  upcoming: 'Upcoming',
  past: 'Past',
  inactive: 'Inactive',
}

function compareSeasons(sort: SeasonSort): (a: Season, b: Season) => number {
  const byName = (a: Season, b: Season) => a.label.localeCompare(b.label)
  // Newest is the latest start date; ties fall to the later end date, then the name.
  const byNewest = (a: Season, b: Season) =>
    b.startDate.localeCompare(a.startDate) || b.endDate.localeCompare(a.endDate) || byName(a, b)
  switch (sort) {
    case 'oldest':
      return (a, b) => -byNewest(a, b)
    case 'name':
      return byName
    default:
      return byNewest
  }
}

// docs/specs/094-club-structure-and-seasons.md (F): the Seasons page on the Leagues and Teams pattern, without a Season
// pill (this page lists the seasons). Four counters computed client-side from the season list (Current, Upcoming, Past,
// Inactive: quick filters, mutually exclusive, a zero one is a plain card), the shared FilterBar (search by label,
// client-side, so the counters ignore it) and content line (sort, Show inactive, Cards | List), and a card or table per
// season whose Leagues / Teams / Matches figures come from GET .../seasons/summary (a dash while loading or if it failed:
// the list never waits for it). The view is remembered (`seasonList:view`); the quick filter, search, sort and Show
// inactive are per visit. Deliberately no pagination - a club's seasons are a small, bounded list
// (docs/specs/029-league-management.md).
export default function SeasonList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SeasonSort>('newest')
  const [focus, setFocus] = useState<SeasonFocus | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [view, setView] = useListViewPreference('seasonList:view')
  // The local calendar date, fixed for this visit.
  const today = useMemo(() => localToday(), [])

  const {
    data: seasons,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  const summaryQuery = useQuery({
    queryKey: seasonsSummaryKey(clubId ?? ''),
    queryFn: () => getSeasonsSummary(clubId as string),
    enabled: Boolean(clubId),
    retry: false,
  })

  // Every club season has a summary entry; one missing from a loaded summary (just created) is empty. Null while the
  // summary loads or when it failed, which the cards and rows show as a dash.
  const summaries = useMemo<Record<string, SeasonSummary> | null>(() => {
    const loaded = summaryQuery.data
    if (!loaded || !seasons) {
      return null
    }
    const byId: Record<string, SeasonSummary> = Object.fromEntries(loaded.seasons.map((entry) => [entry.seasonId, entry]))
    return Object.fromEntries(
      seasons.map((season) => [season.id, byId[season.id] ?? { seasonId: season.id, leagueCount: 0, teamsEntered: 0, matchCount: 0 }]),
    )
  }, [summaryQuery.data, seasons])

  // The counters describe the whole season list: not narrowed by search, the quick filter or Show inactive.
  const counters = useMemo(() => seasonCounters(seasons ?? [], today), [seasons, today])

  const visibleSeasons = useMemo(() => {
    if (!seasons) {
      return []
    }
    // The Inactive quick filter shows inactive seasons whatever the switch says; otherwise inactive ones are hidden
    // until Show inactive is on.
    const shown = showInactive || focus === 'inactive' ? seasons : seasons.filter((season) => season.active)
    const byFocus = focus ? shown.filter((season) => matchesSeasonFocus(season, focus, today)) : shown
    const term = search.trim().toLowerCase()
    const filtered = term ? byFocus.filter((season) => season.label.toLowerCase().includes(term)) : byFocus
    return [...filtered].sort(compareSeasons(sort))
  }, [seasons, showInactive, focus, search, sort, today])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isPending) {
    return null
  }

  if (isError || !seasons) {
    return (
      <EmptyState
        title="Couldn't load seasons"
        description="Something went wrong loading your club's seasons. Please try again."
      />
    )
  }

  const addSeason = () => navigate('/manage/fixtures/seasons/new')
  const hasSeasons = seasons.length > 0
  const isSearching = search.trim().length > 0
  const toggleFocus = (next: SeasonFocus) => setFocus((current) => (current === next ? null : next))
  // A zero counter is a plain card (no marker, not a button) unless it is the active filter, which stays a pressed button
  // so it can be switched off. Current shows a label, so the zero rule is applied here rather than by its value.
  const filterCounter = (id: SeasonFocus, value: string | number, count: number, extra: Partial<PageCounterItem> = {}): PageCounterItem => ({
    id,
    value,
    label: FOCUS_LABELS[id],
    kind: 'filter',
    active: focus === id,
    hint: 'Tap to filter',
    onSelect: count > 0 || focus === id ? () => toggleFocus(id) : undefined,
    ...extra,
  })
  const counterItems: PageCounterItem[] = [
    filterCounter('current', counters.currentLabel, counters.current),
    filterCounter('upcoming', counters.upcoming, counters.upcoming),
    filterCounter('past', counters.past, counters.past),
    filterCounter('inactive', counters.inactive, counters.inactive, { tone: counters.inactive > 0 ? 'warning' : 'default' }),
  ]

  const inactiveToggle = <CompactSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
  const sortLink = <SortMenu value={sort} options={SORT_OPTIONS} onChange={(value) => setSort(value as SeasonSort)} />

  const emptyState = (() => {
    if (!hasSeasons) {
      return (
        <EmptyState
          title="No seasons yet"
          description="Create your club's first season to get started."
          action={<Button onClick={addSeason}>Add Season</Button>}
        />
      )
    }
    if (isSearching) {
      return <EmptyState title="No matching seasons" description={`No seasons match "${search.trim()}". Try a different search.`} />
    }
    if (focus === 'inactive') {
      return <EmptyState title="No inactive seasons" description="Every season is in use." />
    }
    if (focus) {
      return <EmptyState title="No matching seasons" description={`No seasons are ${FOCUS_LABELS[focus].toLowerCase()}.`} />
    }
    return <EmptyState title="No matching seasons" description="Every season here is inactive. Turn on Show inactive to see them." />
  })()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Seasons" action={<Button onClick={addSeason}>Add Season</Button>} />

      <PageCounters density="compact" items={counterItems} />

      <FilterBar
        density="compact"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by label"
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
            {inactiveToggle}
            {sortLink}
          </>
        }
        onClearAll={() => setFocus(null)}
      />

      <ContentControlsLine
        scope={`Showing ${visibleSeasons.length} ${visibleSeasons.length === 1 ? 'season' : 'seasons'}${focus ? ` · ${FOCUS_LABELS[focus]}` : ''}`}
        sortAction={sortLink}
        controls={
          <>
            <ListViewToggle value={view} onChange={setView} />
            {inactiveToggle}
          </>
        }
      />

      {visibleSeasons.length > 0 && view === 'list' && <SeasonTable seasons={visibleSeasons} summaries={summaries} today={today} />}

      {visibleSeasons.length > 0 && view === 'cards' && (
        <Box sx={cardGridSx}>
          {visibleSeasons.map((season) => (
            <SeasonCard key={season.id} season={season} summary={summaries?.[season.id] ?? null} today={today} />
          ))}
        </Box>
      )}

      {visibleSeasons.length === 0 && emptyState}
    </Box>
  )
}
