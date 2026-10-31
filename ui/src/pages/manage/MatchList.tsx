import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Link, Stack, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { CompactSwitch } from '../../components/CompactSwitch'
import { SortMenu } from '../../components/ContentControlsLine'
import type { SortMenuOption } from '../../components/ContentControlsLine'
import { AddCard } from '../../components/AddCard'
import { BrandIcon } from '../../components/BrandIcon'
import { EmptyState } from '../../components/EmptyState'
import { FilterBar } from '../../components/FilterBar'
import { HeaderSeasonSelect } from '../../components/HeaderSeasonSelect'
import { ListViewToggle } from '../../components/ListViewToggle'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { ToolbarCard, ToolbarSortButton, ToolbarToggleChip } from '../../components/ToolbarCard'
import { PageCounters } from '../../components/PageCounters'
import type { PageCounterItem } from '../../components/PageCounters'
import { getMatchesSummary, listMatches, listMatchFilterOptions, matchesSummaryKey } from '../../api/matchApi'
import type { MatchesSummaryFilters, MatchListFocus } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { listSections } from '../../api/sectionApi'
import { listPlayingAreas, playingAreasKey } from '../../api/playingAreaApi'
import { MatchCard } from './matches/MatchCard'
import { MatchTable } from './matches/MatchTable'
import { useListViewPreference } from '../../hooks/useListViewPreference'
import { dynamicCardGridSx } from '../../utils/cardGrid'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import { announcedBadges, badgeFor, sideName } from './matches/matchCardHelpers'

// docs/specs/042-match-list-filters-and-search.md: sort defaults to soonest-upcoming-first. docs/specs/130: the order is the toolbar's
// Sort button (a menu on a phone), as on the Seasons page.
// In-memory only (resets on a full page reload) - see the upcomingOnly state in MatchList below.
let restoreShowPastOnReturn = false

const SORT_OPTIONS: (SortMenuOption & { value: string })[] = [
  { value: 'matchDate,asc', label: 'Soonest First', linkLabel: 'soonest first' },
  { value: 'matchDate,desc', label: 'Latest First', linkLabel: 'latest first' },
]

const SEARCH_DEBOUNCE_MS = 300

// docs/specs/087-matches-polls-alignment.md: the Matches quick filters behind the counters, named as the chip, the
// scope text and the phone sheet's Quick filter row show them.
const FOCUS_LABELS: Record<MatchListFocus, string> = {
  'this-week': 'This Week',
  'not-announced': 'Teams Not Announced',
  'no-poll': 'Without A Poll',
}

// Re-exported for MatchDetailPage.tsx (docs/specs/036) and the tests: the helpers moved to
// matches/matchCardHelpers.ts with the card (docs/specs/069-match-card-redesign.md).
export { sideName, badgeFor, announcedBadges }

export interface MatchListProps {
  // SquadPicker (docs/specs/029-league-management.md) reuses this same paginated data source and
  // card shape, but routes each card's primary action into that match's Playing XI tab instead of
  // Details — a different entry point onto the same underlying Match data, not a second list.
  title?: string
  backTo?: string
  backLabel?: string
  createLabel?: string
  // docs/specs/036-view-first-record-detail-screens.md: defaults to MatchDetailPage's own route —
  // every card and row opens the match; `null` makes them not links.
  viewTo?: ((matchId: string) => string) | null
  onCreate?: () => void
}

// Reads clubId from ManagerHome's Outlet context. The first paginated list in this feature area
// (docs/standards/frontend.md's pagination rule) — a club's match history grows every week across
// every season, unlike Section/Team/Sponsor's small, bounded lists.
export default function MatchList({
  title = 'Matches',
  backTo,
  backLabel,
  createLabel = 'Add Match',
  viewTo = (matchId: string) => `/manage/fixtures/matches/${matchId}`,
  onCreate,
}: MatchListProps) {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  // docs/specs/109-delete-empty-match.md: the success notice a navigation carries in router state (same convention as the
  // league page, 096). Read once, shown until dismissed, then the router state is cleared so a reload does not repeat it.
  const location = useLocation()
  const [notice, setNotice] = useState<string | null>(() => {
    const carried = (location.state as { notice?: unknown } | null)?.notice
    return typeof carried === 'string' ? carried : null
  })
  useEffect(() => {
    if ((location.state as { notice?: unknown } | null)?.notice) {
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location, navigate])
  // docs/specs/127: Add Match returns to this list.
  const addMatchPath = withReturnTo('/manage/fixtures/matches/new', currentOrigin(location), 'Matches')
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)
  // docs/specs/035-section-scoped-access.md: a real, backend-param-driven filter (this list is
  // genuinely paginated) — never a client-side one, per docs/standards/frontend.md's pagination
  // rule.
  const [sectionId, setSectionId] = useState<string | null>(null)
  // docs/specs/042-match-list-filters-and-search.md: League/Season filters, same backend-driven
  // shape as sectionId above — combinable with it and with search/upcomingOnly in any combination.
  const [leagueId, setLeagueId] = useState<string | null>(null)
  const [seasonId, setSeasonId] = useState<string | null>(null)
  // docs/specs/087: Team and the counters' quick filter. Both are backend params too, and per visit only: neither
  // is saved with Section/League/Season below. At most one quick filter is active at a time.
  const [teamId, setTeamId] = useState<string | null>(null)
  const [focus, setFocus] = useState<MatchListFocus | null>(null)
  // docs/specs/099-fields-directory.md: matches on one field, a backend param, per visit like Team.
  const [playingAreaId, setPlayingAreaId] = useState<string | null>(null)
  // docs/specs/089 (C): Cards | List, remembered for this page.
  const [view, setView] = useListViewPreference('matchList:view')
  // docs/specs/037-match-improvements.md item 1: the list defaults to upcoming matches only. The
  // "Show past matches" switch in the toolbar flips this, so a match saved with a wrong date (and
  // therefore hidden from the default view) can still be found and corrected.
  // Kept across a round-trip into a match's own page (edit/view, then Save/Cancel back to this
  // list) but never across a fresh visit: the flag is only written on unmount while heading to a
  // /manage/fixtures/matches/<id>... route, and every other way of leaving overwrites it with false.
  const [upcomingOnly, setUpcomingOnly] = useState(() => !restoreShowPastOnReturn)
  const upcomingOnlyRef = useRef(upcomingOnly)
  upcomingOnlyRef.current = upcomingOnly
  useEffect(
    () => () => {
      restoreShowPastOnReturn =
        !upcomingOnlyRef.current && /^\/manage\/fixtures\/matches\/[^/]+/.test(window.location.pathname)
    },
    [],
  )

  // docs/specs/042-match-list-filters-and-search.md: real, backend-driven search — MatchController
  // now has a `search` query param and actually applies it (previously a documented no-op).
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, sort, sectionId, leagueId, seasonId, teamId, focus, playingAreaId, upcomingOnly])

  // docs/specs/042-match-list-filters-and-search.md: Section/League/Season selections (never
  // search) persist per club across visits — the first localStorage call site in this codebase,
  // so every access is individually try/catch-guarded rather than assuming it's always available
  // (private browsing, quota, disabled storage). Loaded once on mount/clubId-change; write-back
  // effect below keeps it current after that.
  const filtersStorageKey = `matchList:filters:${clubId}`

  useEffect(() => {
    if (!clubId) return
    try {
      const raw = localStorage.getItem(filtersStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.sectionId) setSectionId(parsed.sectionId)
        if (parsed.leagueId) setLeagueId(parsed.leagueId)
        if (parsed.seasonId) setSeasonId(parsed.seasonId)
      }
    } catch {
      // storage unavailable/corrupt — start from defaults, never throw
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId])

  useEffect(() => {
    if (!clubId) return
    try {
      localStorage.setItem(filtersStorageKey, JSON.stringify({ sectionId, leagueId, seasonId }))
    } catch {
      // storage full/unavailable — filters just won't persist this session
    }
  }, [clubId, filtersStorageKey, sectionId, leagueId, seasonId])

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'matches', page, debouncedSearch, sort, sectionId, leagueId, seasonId, teamId, focus, playingAreaId, upcomingOnly],
    queryFn: () =>
      listMatches(clubId as string, {
        page,
        sort,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(leagueId ? { leagueId } : {}),
        ...(seasonId ? { seasonId } : {}),
        ...(teamId ? { teamId } : {}),
        ...(focus ? { focus } : {}),
        ...(playingAreaId ? { playingAreaId } : {}),
        upcomingOnly,
      }),
    enabled: Boolean(clubId),
    // Keep the previous page on screen while a filter or counter change loads, so the toolbar and counters stay
    // mounted (and the search field keeps its focus) instead of the whole screen blanking each time.
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

  // The Field filter offers every field the club linked or used on a match (away grounds included), from the directory's paged search.
  const { data: ownFields } = useQuery({
    queryKey: [...playingAreasKey(clubId ?? ''), 'match-filter', 'used'],
    queryFn: () => listPlayingAreas(clubId as string, { size: 200, usedByClub: true }),
    enabled: Boolean(clubId),
    retry: false,
  })

  const { data: seasons } = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  // docs/specs/042-match-list-filters-and-search.md: given the *currently selected* filters, which
  // section/league/season ids are actually reachable — narrows each of the three pickers' own
  // option lists below so an admin never picks a combination with nothing in it.
  const filterOptionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', 'filter-options', sectionId, leagueId, seasonId, teamId, debouncedSearch, upcomingOnly],
    queryFn: () =>
      listMatchFilterOptions(clubId as string, {
        sectionId: sectionId ?? undefined,
        leagueId: leagueId ?? undefined,
        seasonId: seasonId ?? undefined,
        teamId: teamId ?? undefined,
        search: debouncedSearch || undefined,
        upcomingOnly,
      }),
    enabled: Boolean(clubId),
  })

  // docs/specs/087: the counters, for exactly the filters the list sends (the quick filter itself does not narrow
  // them, so the first card stays a meaningful way back). A failed request hides the row; the list still works.
  const summaryFilters: MatchesSummaryFilters = {
    sectionId: sectionId ?? undefined,
    leagueId: leagueId ?? undefined,
    seasonId: seasonId ?? undefined,
    teamId: teamId ?? undefined,
    search: debouncedSearch || undefined,
    playingAreaId: playingAreaId ?? undefined,
    includePast: !upcomingOnly,
  }
  const summaryQuery = useQuery({
    queryKey: matchesSummaryKey(clubId ?? '', summaryFilters),
    queryFn: () => getMatchesSummary(clubId as string, summaryFilters),
    enabled: Boolean(clubId),
    retry: false,
    placeholderData: keepPreviousData,
  })

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

  // docs/specs/042-match-list-filters-and-search.md: filtered against filter-options' own
  // reachable-id arrays before being passed to each picker — while filterOptionsQuery is still
  // loading (or hasn't run yet), the full unfiltered list renders rather than flashing empty
  // dropdowns on every keystroke/filter change.
  const filterableSections = useMemo(
    () => (sections ?? []).filter((section) => !filterOptionsQuery.data || filterOptionsQuery.data.sectionIds.includes(section.id)),
    [sections, filterOptionsQuery.data],
  )

  const filterableLeagues = useMemo(
    () => (leagues ?? []).filter((league) => !filterOptionsQuery.data || filterOptionsQuery.data.leagueIds.includes(league.id)),
    [leagues, filterOptionsQuery.data],
  )

  const filterableSeasons = useMemo(
    () => (seasons ?? []).filter((season) => !filterOptionsQuery.data || filterOptionsQuery.data.seasonIds.includes(season.id)),
    [seasons, filterOptionsQuery.data],
  )

  // docs/specs/087: the Team picker offers the club's teams that filter-options reports as reachable (its teamIds
  // ignores the Team pick itself, so choosing a team never empties its own list).
  const filterableTeams = useMemo(
    () =>
      Array.from(teamsById.values())
        .filter((team) => !filterOptionsQuery.data || filterOptionsQuery.data.teamIds.includes(team.id))
        .map((team) => ({ id: team.id, name: team.name })),
    [teamsById, filterOptionsQuery.data],
  )

  // docs/specs/042-match-list-filters-and-search.md: client-side suggestions drawn from the club's
  // own already-loaded Team names — narrowed to teams filterOptionsQuery reports as reachable
  // given the currently active Section/League/Season filters first (a team outside the current
  // filter scope is never suggested — see MatchFilterOptions.teamIds' own doc comment for why this
  // doesn't also narrow by search itself), then filtered to those containing the currently-typed
  // substring. No new endpoint beyond filter-options, no server debounce for the suggestion list
  // itself (only the real backend search call, via debouncedSearch above, stays debounced).
  const searchSuggestions = useMemo(() => {
    const term = search.trim().toLowerCase()
    const reachableTeams = filterOptionsQuery.data
      ? Array.from(teamsById.values()).filter((team) => filterOptionsQuery.data.teamIds.includes(team.id))
      : Array.from(teamsById.values())
    const names = reachableTeams.map((team) => team.name)
    return term ? names.filter((name) => name.toLowerCase().includes(term)) : names
  }, [search, teamsById, filterOptionsQuery.data])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Couldn't load matches"
        description="Something went wrong loading your club's matches. Please try again."
      />
    )
  }

  const hasMatches = data.content.length > 0
  const isSearching = debouncedSearch.length > 0
  // Choosing the active counter again turns its filter off; choosing another replaces it.
  const toggleFocus = (next: MatchListFocus) => setFocus((current) => (current === next ? null : next))
  const summary = summaryQuery.data
  const counters: PageCounterItem[] = summary
    ? [
        {
          id: 'shown',
          value: summary.matchesShown,
          label: upcomingOnly ? 'Upcoming Matches' : 'Matches Shown',
          shortLabel: upcomingOnly ? 'Upcoming' : 'Shown',
          kind: 'filter',
          active: focus === null,
          hint: 'Show all',
          onSelect: () => setFocus(null),
        },
        {
          id: 'this-week',
          value: summary.thisWeek,
          label: FOCUS_LABELS['this-week'],
          kind: 'filter',
          active: focus === 'this-week',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('this-week'),
        },
        {
          id: 'not-announced',
          value: summary.teamsNotAnnounced,
          label: FOCUS_LABELS['not-announced'],
          shortLabel: 'Not Announced',
          tone: summary.teamsNotAnnounced > 0 ? 'warning' : 'default',
          kind: 'filter',
          active: focus === 'not-announced',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('not-announced'),
        },
        {
          id: 'no-poll',
          value: summary.withoutPoll,
          label: FOCUS_LABELS['no-poll'],
          shortLabel: 'No Poll',
          tone: summary.withoutPoll > 0 ? 'warning' : 'default',
          kind: 'filter',
          active: focus === 'no-poll',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('no-poll'),
        },
      ]
    : []
  const showCounters = !summaryQuery.isError && (summaryQuery.isPending || Boolean(summary))
  const pastLabel = seasonId ? 'View Entire Season' : 'View All Seasons'
  const sortLink = <SortMenu value={sort} options={SORT_OPTIONS} onChange={setSort} />

  const emptyState = (() => {
    if (hasMatches) {
      return null
    }
    const icon = <BrandIcon name="nav/upcoming-matches" size={48} />
    if (isSearching) {
      return <EmptyState icon={icon} title="No matching matches" description={`No matches match "${debouncedSearch}". Try a different search.`} />
    }
    return (
      <EmptyState
        icon={icon}
        title={upcomingOnly ? 'No upcoming matches' : 'No matches yet'}
        description={
          upcomingOnly
            ? 'Nothing scheduled ahead. Turn on "View Entire Season" to see earlier fixtures, or schedule a new one.'
            : "Schedule your club's first match to get started."
        }
      />
    )
  })()

  const bar = (
    <FilterBar
      density="compact"
      bare
      inCard
      viewControlsInline
      leagues={filterableLeagues}
      sections={filterableSections}
      teams={filterableTeams}
      leagueId={leagueId}
      sectionId={sectionId}
      teamId={teamId}
      onLeagueChange={setLeagueId}
      onSectionChange={setSectionId}
      onTeamChange={setTeamId}
      searchValue={search}
      onSearchChange={setSearch}
      extraSelects={
        ownFields && ownFields.content.length > 0
          ? [
              {
                key: 'field',
                label: 'Field',
                allLabel: 'All fields',
                options: ownFields.content.map((field) => ({ value: field.id, label: field.name })),
                value: playingAreaId ?? '',
                onChange: (value: string) => setPlayingAreaId(value || null),
              },
            ]
          : []
      }
      searchPlaceholder="Search by opponent or team name"
      searchOptions={searchSuggestions}
      extraChips={focus ? [{ key: 'focus', label: FOCUS_LABELS[focus], onRemove: () => setFocus(null) }] : []}
      // Desktop order (page-anatomy section 3): the season toggle, then Sort, then the Cards | List toggle last. A phone sheet: toggle first.
      secondaryControls={(placement) =>
        placement === 'row' ? (
          <ToolbarToggleChip pressed={!upcomingOnly} onChange={(pressed) => setUpcomingOnly(!pressed)} label={pastLabel} />
        ) : (
          <CompactSwitch checked={!upcomingOnly} onChange={(checked) => setUpcomingOnly(!checked)} label={pastLabel} />
        )
      }
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
            <ToolbarSortButton value={sort} onChange={setSort} options={SORT_OPTIONS.map(({ value, label }) => ({ value, label }))} />
            <ListViewToggle value={view} onChange={setView} variant="toolbar" />
          </>
        )
      }
      onClearAll={() => {
        setLeagueId(null)
        setSectionId(null)
        setTeamId(null)
        setPlayingAreaId(null)
        setFocus(null)
      }}
    />
  )
  // List view: the bar is fused into the table's card in every state. Cards view: a standalone toolbar card.
  const fused = view === 'list'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ManageScreenHeader
        title={title}
        backTo={backTo}
        backLabel={backLabel}
        // docs/specs/089: Season is a small pill beside the title, not a toolbar field - it rarely changes.
        titleAdornment={
          <HeaderSeasonSelect
            seasons={filterableSeasons.map((season) => ({ id: season.id, name: season.label }))}
            value={seasonId}
            onChange={setSeasonId}
          />
        }
        action={
          <Button size="compact" onClick={onCreate ?? (() => navigate(addMatchPath))} sx={{ flex: 'none' }}>{createLabel}</Button>
        }
      />

      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
        {!fused && <ToolbarCard>{bar}</ToolbarCard>}

        {view === 'list' && (
          <MatchTable
            clubId={clubId}
            matches={data.content}
            teamsById={teamsById}
            leaguesById={leaguesById}
            seasonsById={seasonsById}
            viewTo={viewTo ? (match) => viewTo(match.id) : undefined}
            toolbar={bar}
            empty={emptyState}
          />
        )}

        {view === 'cards' ? emptyState : null}

        {view === 'cards' && (
          <Box sx={dynamicCardGridSx}>
            {data.content.map((match) => (
              <MatchCard
                key={match.id}
                clubId={clubId}
                match={match}
                teamsById={teamsById}
                leaguesById={leaguesById}
                seasonsById={seasonsById}
                viewTo={viewTo ? viewTo(match.id) : undefined}
              />
            ))}
            {/* The grid ends with a dashed Add card (same route as the page's Add Match button); with no cards it is the only one. */}
            <AddCard label="Add Match" to={onCreate ? undefined : addMatchPath} onClick={onCreate} testId="add-match-card" />
          </Box>
        )}
      </Box>

      {hasMatches && data.totalPages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
          <Button size="compact" variant="secondary" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
            Previous
          </Button>
          <Typography variant="body2" color="text.secondary">
            Page {data.number + 1} of {data.totalPages}
          </Typography>
          <Button
            size="compact"
            variant="secondary"
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </Stack>
      )}
    </Box>
  )
}
