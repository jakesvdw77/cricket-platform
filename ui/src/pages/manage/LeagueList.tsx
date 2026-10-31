import { useMemo, useState } from 'react'
import { Box, Link, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { CompactSwitch } from '../../components/CompactSwitch'
import { SortLink } from '../../components/ContentControlsLine'
import { BrandIcon } from '../../components/BrandIcon'
import { EmptyState } from '../../components/EmptyState'
import { FilterBar } from '../../components/FilterBar'
import { HeaderSeasonSelect } from '../../components/HeaderSeasonSelect'
import { ListViewToggle } from '../../components/ListViewToggle'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { ToolbarCard, ToolbarSortButton, ToolbarToggleChip } from '../../components/ToolbarCard'
import { PageCounters } from '../../components/PageCounters'
import type { PageCounterItem } from '../../components/PageCounters'
import { getLeaguesSummary, leaguesSummaryKey, listLeagues, LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import type { LeagueFormat, LeagueListFocus } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import { useListViewPreference } from '../../hooks/useListViewPreference'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'
import { dynamicCardGridSx } from '../../utils/cardGrid'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import { AddCard } from '../../components/AddCard'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { ShareLeagueDialog } from '../../components/ShareLeagueDialog'
import type { League } from '../../api/leagueApi'
import { DuplicateLeagueDialog } from './leagues/DuplicateLeagueDialog'
import { LeagueCard } from './leagues/LeagueCard'
import { LeagueTable } from './leagues/LeagueTable'

const FORMATS = Object.keys(LEAGUE_FORMAT_LABELS) as LeagueFormat[]

const FOCUS_LABELS: Record<LeagueListFocus, string> = {
  active: 'Active leagues',
  'this-week': 'Matches this week',
  attention: 'Setup needed',
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
// leagues, Matches this week, Setup needed) or plain figures (Teams entered, Players, Seasons), the shared FilterBar
// (Format and search, client-side as before) and content line (sort, Show inactive, Cards | List). The season, Format and
// the view are remembered; the quick filter and Show inactive are per visit. Deliberately no pagination - a club's own
// leagues are a small, bounded list (docs/specs/029-league-management.md).
export default function LeagueList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  // docs/specs/127: Add League returns to this list.
  const addLeaguePath = withReturnTo('/manage/fixtures/leagues/new', currentOrigin(location), 'Leagues')
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [focus, setFocus] = useState<LeagueListFocus | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [view, setView] = useListViewPreference('leagueList:view')
  // docs/specs/122-league-sharing.md: the one Share League dialog of the page, opened from a card or a row.
  const [shareLeague, setShareLeague] = useState<League | null>(null)
  // docs/specs/096: the one Duplicate League dialog of the page, opened from a row's or card's Actions menu.
  const [duplicateLeague, setDuplicateLeague] = useState<League | null>(null)
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

  const bar = (
    <FilterBar
          density="compact"
          bare
          inCard
          viewControlsInline
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
          // Desktop order (page-anatomy section 3): switches, then Sort, then the Cards | List toggle last. A phone sheet: toggle first.
          secondaryControls={(placement) => (placement === 'row' ? <ToolbarToggleChip pressed={showInactive} onChange={setShowInactive} label="Show inactive" /> : inactiveToggle)}
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
                {sortLink}
              </>
            ) : (
              <>
                <ToolbarSortButton
                  value={sortAsc ? 'asc' : 'desc'}
                  onChange={(next) => setSortAsc(next === 'asc')}
                  options={[{ value: 'asc', label: 'Name, A to Z' }, { value: 'desc', label: 'Name, Z to A' }]}
                />
                <ListViewToggle value={view} onChange={setView} variant="toolbar" />
              </>
            )
          }
          onClearAll={() => {
            setFilters({ format: '' })
            setFocus(null)
          }}
        />
  )
  // The message for an empty result. In List view it replaces the rows INSIDE the fused card, so the toolbar never remounts.
  const emptyState = (() => {
    if (visibleLeagues.length > 0) {
      return null
    }
    if (visibleLeagues.length === 0 && hasLeagues && isFiltering) {
      return (
        <EmptyState
          icon={<BrandIcon name="nav/cricket-leagues" size={48} />}
          title="No matching leagues"
          description={focus && !isSearching && format === '' ? `No leagues match ${FOCUS_LABELS[focus].toLowerCase()}.` : noMatchDescription(search.trim(), format)}
        />
      )
    }
    if (!hasLeagues && !isFiltering && !showInactive) {
      return (
        <EmptyState icon={<BrandIcon name="nav/cricket-leagues" size={48} />} title="No league available" description="Create your club's first league to get started." />
      )
    }
    if (!hasLeagues && (isFiltering || showInactive)) {
      return (
        <EmptyState
          icon={<BrandIcon name="nav/cricket-leagues" size={48} />}
          title={focus ? 'No matching leagues' : 'No league available'}
          description={focus ? `No leagues match ${FOCUS_LABELS[focus].toLowerCase()}.` : 'Create your club\'s first league to get started.'}
        />
      )
    }
    return null
  })()
  // List view: the bar is fused into the table's card in every state (rows or the empty message). Cards view: a standalone toolbar card.
  const fused = view === 'list'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
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
        action={<Button size="compact" onClick={() => navigate(addLeaguePath)}>Add League</Button>}
      />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      {!fused && <ToolbarCard>{bar}</ToolbarCard>}

      {view === 'list' && <LeagueTable leagues={visibleLeagues} seasonId={seasonId || undefined} onShare={setShareLeague} onDuplicate={setDuplicateLeague} toolbar={bar} empty={emptyState} />}

      {view === 'cards' ? emptyState : null}

      {view === 'cards' && (
        <Box sx={dynamicCardGridSx}>
          {visibleLeagues.map((league) => (
            <LeagueCard key={league.id} league={league} seasonId={seasonId || undefined} onShare={setShareLeague} onDuplicate={setDuplicateLeague} />
          ))}
          {/* The grid ends with a dashed Add card (same route as the page's Add League button); with no cards it is the only one. */}
          <AddCard label="Add League" to={addLeaguePath} testId="add-league-card" />
        </Box>
      )}

      </Box>

      {clubId && shareLeague && (
        <ShareLeagueDialog
          open
          onClose={() => setShareLeague(null)}
          clubId={clubId}
          league={shareLeague}
          seasonId={seasonId || null}
          preselected={['DETAILS', 'SCHEDULE']}
        />
      )}

      {clubId && duplicateLeague && (
        <DuplicateLeagueDialog
          open
          clubId={clubId}
          league={{ id: duplicateLeague.id, name: duplicateLeague.name }}
          seasons={seasons}
          defaultSeasonId={seasonId}
          onClose={() => setDuplicateLeague(null)}
        />
      )}
    </Box>
  )
}
