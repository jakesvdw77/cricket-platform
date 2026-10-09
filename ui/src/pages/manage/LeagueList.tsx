import { useMemo, useState } from 'react'
import { Box, Link, Typography } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { CompactSwitch } from '../../components/CompactSwitch'
import { ContentControlsLine, SortLink } from '../../components/ContentControlsLine'
import { EmptyState } from '../../components/EmptyState'
import { FilterBar } from '../../components/FilterBar'
import { HeaderSeasonSelect } from '../../components/HeaderSeasonSelect'
import { ListViewToggle } from '../../components/ListViewToggle'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { PageCounters } from '../../components/PageCounters'
import type { PageCounterItem } from '../../components/PageCounters'
import { getLeaguesSummary, leaguesSummaryKey, listLeagues, LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import type { LeagueFormat, LeagueListFocus } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import { useListViewPreference } from '../../hooks/useListViewPreference'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'
import { cardGridSx } from '../../utils/cardGrid'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { LeagueCard } from './leagues/LeagueCard'
import { LeagueTable } from './leagues/LeagueTable'

const FORMATS = Object.keys(LEAGUE_FORMAT_LABELS) as LeagueFormat[]

const FOCUS_LABELS: Record<LeagueListFocus, string> = {
  active: 'Active leagues',
  'this-week': 'Matches this week',
  attention: 'Need attention',
}

function noMatchDescription(term: string, format: string): string {
  const formatLabel = format ? LEAGUE_FORMAT_LABELS[format as LeagueFormat] ?? format : ''
  if (term && formatLabel) {
    return `No ${formatLabel} leagues match "${term}". Try a different search or choose All formats.`
  }
  if (formatLabel) {
    return `No ${formatLabel} leagues found. Choose All formats to see every league.`
  }
  return `No leagues match "${term}". Try a different search.`
}

// docs/specs/091-leagues-gold-standard.md (A): the Leagues page on the Polls / Matches / Players pattern - a Season pill
// beside the title (every card, counter and the list describe that season), counters that are quick filters (Active
// leagues, Matches this week, Need attention) or plain figures (Teams entered, Players, Seasons), the shared FilterBar
// (Format and search, client-side as before) and content line (sort, Show inactive, Cards | List). The season, Format and
// the view are remembered; the quick filter and Show inactive are per visit. Deliberately no pagination - a club's own
// leagues are a small, bounded list (docs/specs/029-league-management.md).
export default function LeagueList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [focus, setFocus] = useState<LeagueListFocus | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [view, setView] = useListViewPreference('leagueList:view')
  // docs/specs/071: Format is client-side but persisted per club; 091 persists the chosen season with it.
  const [{ format, seasonId: savedSeasonId }, setFilters] = usePersistedListFilters(`leagueList:filters:${clubId}`, {
    format: '',
    seasonId: '',
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })
  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])
  // The chosen season when it is still one of the club's, else the one containing today (or the latest).
  const seasonId = useMemo(
    () => (seasons.some((season) => season.id === savedSeasonId) ? savedSeasonId : (pickDefaultSeasonId(seasons) ?? '')),
    [seasons, savedSeasonId],
  )
  const seasonReady = !seasonsQuery.isPending

  const filters = { seasonId: seasonId || undefined, includeInactive: showInactive ? undefined : (false as const) }
  const listFilters = { ...filters, focus: focus ?? undefined }

  const {
    data: leagues,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', 'list', listFilters],
    queryFn: () => listLeagues(clubId as string, listFilters),
    enabled: Boolean(clubId) && seasonReady,
    placeholderData: keepPreviousData,
  })

  const summaryQuery = useQuery({
    queryKey: leaguesSummaryKey(clubId ?? '', filters),
    queryFn: () => getLeaguesSummary(clubId as string, filters),
    enabled: Boolean(clubId) && seasonReady,
    placeholderData: keepPreviousData,
    retry: false,
  })

  const visibleLeagues = useMemo(() => {
    if (!leagues) {
      return []
    }
    const term = search.trim().toLowerCase()
    const byName = term ? leagues.filter((league) => league.name.toLowerCase().includes(term)) : leagues
    const filtered = format ? byName.filter((league) => league.format === format) : byName
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    return sortAsc ? sorted : sorted.reverse()
  }, [leagues, search, format, sortAsc])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isPending && !leagues) {
    return null
  }

  if (isError || !leagues) {
    return (
      <EmptyState
        title="Couldn't load leagues"
        description="Something went wrong loading your club's leagues. Please try again."
      />
    )
  }

  const hasLeagues = leagues.length > 0
  const isSearching = search.trim().length > 0
  const isFiltering = isSearching || format !== '' || focus !== null
  const toggleFocus = (next: LeagueListFocus) => setFocus((current) => (current === next ? null : next))
  const summary = summaryQuery.data
  const counters: PageCounterItem[] = summary
    ? [
        {
          id: 'active',
          value: summary.active,
          label: FOCUS_LABELS.active,
          shortLabel: 'Active',
          kind: 'filter',
          active: focus === 'active',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('active'),
        },
        { id: 'teams', value: summary.teamsEntered, label: 'Teams entered', shortLabel: 'Teams' },
        { id: 'players', value: summary.players, label: 'Players' },
        { id: 'seasons', value: summary.seasons, label: 'Seasons' },
        {
          id: 'this-week',
          value: summary.matchesThisWeek,
          label: FOCUS_LABELS['this-week'],
          shortLabel: 'This week',
          kind: 'filter',
          active: focus === 'this-week',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('this-week'),
        },
        {
          id: 'attention',
          value: summary.needAttention,
          label: FOCUS_LABELS.attention,
          tone: summary.needAttention > 0 ? 'warning' : 'default',
          kind: 'filter',
          active: focus === 'attention',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('attention'),
        },
      ]
    : []
  const showCounters = !summaryQuery.isError && (summaryQuery.isPending || Boolean(summary))
  const inactiveToggle = <CompactSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
  const sortLink = <SortLink label={sortAsc ? 'Name, A to Z' : 'Name, Z to A'} onToggle={() => setSortAsc((current) => !current)} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Leagues"
        // docs/specs/091: the season every card, counter and row describes; there is no "All seasons" here.
        titleAdornment={
          seasons.length > 0 ? (
            <HeaderSeasonSelect
              seasons={seasons.map((season) => ({ id: season.id, name: season.label }))}
              value={seasonId || null}
              onChange={(next) => setFilters({ seasonId: next ?? '' })}
              showAll={false}
            />
          ) : undefined
        }
        action={<Button onClick={() => navigate('/manage/fixtures/leagues/new')}>Add League</Button>}
      />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <FilterBar
        density="compact"
        extraSelects={[
          {
            key: 'format',
            label: 'Format',
            allLabel: 'All formats',
            options: FORMATS.map((value) => ({ value, label: LEAGUE_FORMAT_LABELS[value] })),
            value: format,
            onChange: (value) => setFilters({ format: value }),
          },
        ]}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
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
        onClearAll={() => {
          setFilters({ format: '' })
          setFocus(null)
        }}
      />

      <ContentControlsLine
        scope={`Showing ${visibleLeagues.length} ${visibleLeagues.length === 1 ? 'league' : 'leagues'}${focus ? ` · ${FOCUS_LABELS[focus]}` : ''}`}
        sortAction={sortLink}
        controls={
          <>
            <ListViewToggle value={view} onChange={setView} />
            {inactiveToggle}
          </>
        }
      />

      {visibleLeagues.length > 0 && view === 'list' && <LeagueTable leagues={visibleLeagues} seasonId={seasonId || undefined} />}

      {visibleLeagues.length > 0 && view === 'cards' && (
        <Box sx={cardGridSx}>
          {visibleLeagues.map((league) => (
            <LeagueCard key={league.id} league={league} seasonId={seasonId || undefined} />
          ))}
        </Box>
      )}

      {visibleLeagues.length === 0 && hasLeagues && isFiltering && (
        <EmptyState
          title="No matching leagues"
          description={focus && !isSearching && format === '' ? `No leagues match ${FOCUS_LABELS[focus].toLowerCase()}.` : noMatchDescription(search.trim(), format)}
        />
      )}

      {!hasLeagues && !isFiltering && !showInactive && (
        <EmptyState title="No leagues yet" description="Create your club's first league to get started." />
      )}

      {!hasLeagues && (isFiltering || showInactive) && (
        <EmptyState
          title={focus ? 'No matching leagues' : 'No leagues yet'}
          description={focus ? `No leagues match ${FOCUS_LABELS[focus].toLowerCase()}.` : 'Create your club\'s first league to get started.'}
        />
      )}
    </Box>
  )
}
