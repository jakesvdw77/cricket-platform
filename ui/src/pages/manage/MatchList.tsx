import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Link, Stack, Typography } from '@mui/material'
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
import { getMatchesSummary, listMatches, listMatchFilterOptions, matchesSummaryKey } from '../../api/matchApi'
import type { MatchesSummaryFilters, MatchListFocus } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { listSections } from '../../api/sectionApi'
import { MatchCard } from './matches/MatchCard'
import { MatchTable } from './matches/MatchTable'
import { useListViewPreference } from '../../hooks/useListViewPreference'
import { cardGridSx } from '../../utils/cardGrid'
import { scopeFilterText } from '../../utils/availabilityScope'
import { announcedBadges, badgeFor, sideName } from './matches/matchCardHelpers'

// docs/specs/042-match-list-filters-and-search.md: sort defaults to soonest-upcoming-first — index
// 0 (the default) is ascending. docs/specs/087: the order is switched by the quiet SortLink on the
// content line (in the Filters sheet on a phone), as on the Polls page.
// In-memory only (resets on a full page reload) — see the upcomingOnly state in MatchList below.
let restoreShowPastOnReturn = false

const SORT_OPTIONS = [
  { value: 'matchDate,asc', label: 'Match date (soonest first)' },
  { value: 'matchDate,desc', label: 'Match date (latest first)' },
]

const SEARCH_DEBOUNCE_MS = 300

// docs/specs/087-matches-polls-alignment.md: the Matches quick filters behind the counters, named as the chip, the
// scope text and the phone sheet's Quick filter row show them.
const FOCUS_LABELS: Record<MatchListFocus, string> = {
  'this-week': 'This week',
  'not-announced': 'Teams not announced',
  'no-poll': 'Without a poll',
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
  editTo?: (matchId: string) => string
  // docs/specs/036-view-first-record-detail-screens.md: defaults to MatchDetailPage's own route —
  // every card's primary action becomes "View" (editTo is then only reachable via that view
  // screen's own Edit action). SquadPicker.tsx passes `null` to opt out entirely and keep its own
  // "jump straight to the Playing XI tab" editTo shortcut as this list's primary action instead.
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
  editTo = (matchId: string) => `/manage/fixtures/matches/${matchId}/edit`,
  viewTo = (matchId: string) => `/manage/fixtures/matches/${matchId}`,
  onCreate,
}: MatchListProps) {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
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
  }, [debouncedSearch, sort, sectionId, leagueId, seasonId, teamId, focus, upcomingOnly])

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
    queryKey: ['managed-club', clubId, 'matches', page, debouncedSearch, sort, sectionId, leagueId, seasonId, teamId, focus, upcomingOnly],
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
  const seasonLabel = seasonId ? seasonsById.get(seasonId)?.label : undefined
  const scope = [
    scopeFilterText({ sections: sections ?? [], sectionId, leagues: leagues ?? [], leagueId, teams: filterableTeams, teamId }),
    seasonLabel,
  ]
    .filter(Boolean)
    .join(' · ')
  // Choosing the active counter again turns its filter off; choosing another replaces it.
  const toggleFocus = (next: MatchListFocus) => setFocus((current) => (current === next ? null : next))
  const summary = summaryQuery.data
  const counters: PageCounterItem[] = summary
    ? [
        {
          id: 'shown',
          value: summary.matchesShown,
          label: upcomingOnly ? 'Upcoming matches' : 'Matches shown',
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
          shortLabel: 'Not announced',
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
          shortLabel: 'No poll',
          tone: summary.withoutPoll > 0 ? 'warning' : 'default',
          kind: 'filter',
          active: focus === 'no-poll',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('no-poll'),
        },
      ]
    : []
  const showCounters = !summaryQuery.isError && (summaryQuery.isPending || Boolean(summary))
  const pastToggle = <CompactSwitch checked={!upcomingOnly} onChange={(checked) => setUpcomingOnly(!checked)} label={seasonId ? 'View entire season' : 'View all seasons'} />
  const sortLink = (
    <SortLink
      label={sort === 'matchDate,asc' ? 'soonest first' : 'latest first'}
      onToggle={() => setSort(sort === 'matchDate,asc' ? 'matchDate,desc' : 'matchDate,asc')}
    />
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title={title}
        backTo={backTo}
        backLabel={backLabel}
        // docs/specs/087: the scope of the list under the title when a filter is set, as on Availability.
        subtitle={scope ? `Showing: ${scope}` : undefined}
        // docs/specs/089: Season is a small pill beside the title, not a toolbar field - it rarely changes.
        titleAdornment={
          <HeaderSeasonSelect
            seasons={filterableSeasons.map((season) => ({ id: season.id, name: season.label }))}
            value={seasonId}
            onChange={setSeasonId}
          />
        }
        action={
          <Button onClick={onCreate ?? (() => navigate('/manage/fixtures/matches/new'))}>{createLabel}</Button>
        }
      />

      {/* docs/specs/087-matches-polls-alignment.md (B): the Polls toolbar - the shared FilterBar (League,
          Section, Team and search; Season is the pill in the header, 089; Team arrives with its backend param in the counters slice) and a content
          line with the scope text, the sort link and the Show past matches switch. On a phone the switch and
          the sort link move into the FilterBar sheet. */}
      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <FilterBar
        density="compact"
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
            {pastToggle}
            {sortLink}
          </>
        }
        onClearAll={() => {
          setLeagueId(null)
          setSectionId(null)
          setTeamId(null)
          setFocus(null)
        }}
      />

      <ContentControlsLine
        scope={`Showing ${data.totalElements} ${upcomingOnly ? 'upcoming ' : ''}${data.totalElements === 1 ? 'match' : 'matches'}${focus ? ` · ${FOCUS_LABELS[focus]}` : ''}`}
        sortAction={sortLink}
        controls={
          <>
            <ListViewToggle value={view} onChange={setView} />
            {pastToggle}
          </>
        }
      />

      {hasMatches && view === 'list' && (
        <MatchTable
          matches={data.content}
          teamsById={teamsById}
          leaguesById={leaguesById}
          seasonsById={seasonsById}
          viewTo={viewTo ? (match) => viewTo(match.id) : undefined}
        />
      )}

      {hasMatches && view === 'cards' && (
        <Box sx={cardGridSx}>
          {data.content.map((match) => (
            <MatchCard
              key={match.id}
              clubId={clubId}
              match={match}
              teamsById={teamsById}
              leaguesById={leaguesById}
              seasonsById={seasonsById}
              editTo={editTo(match.id)}
              viewTo={viewTo ? viewTo(match.id) : undefined}
            />
          ))}
        </Box>
      )}

      {!hasMatches && isSearching && (
        <EmptyState
          title="No matching matches"
          description={`No matches match "${debouncedSearch}". Try a different search.`}
        />
      )}

      {!hasMatches && !isSearching && (
        <EmptyState
          title={upcomingOnly ? 'No upcoming matches' : 'No matches yet'}
          description={
            upcomingOnly
              ? 'Nothing scheduled ahead. Turn on "View entire season" to see earlier fixtures, or schedule a new one.'
              : "Schedule your club's first match to get started."
          }
        />
      )}

      {hasMatches && data.totalPages > 1 && (
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
    </Box>
  )
}
