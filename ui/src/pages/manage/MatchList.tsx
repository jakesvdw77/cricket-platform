import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import MenuItem from '@mui/material/MenuItem'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListToolbar } from '../../components/ListToolbar'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { listMatches, listMatchFilterOptions } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { listSections } from '../../api/sectionApi'
import { MatchCard } from './matches/MatchCard'
import { cardGridSx } from '../../utils/cardGrid'
import { announcedBadges, badgeFor, sideName } from './matches/matchCardHelpers'

// docs/specs/042-match-list-filters-and-search.md: sort defaults to soonest-upcoming-first — index
// 0 (the default) is now ascending. Both entries stay in this array for the underlying
// value/label pairing ListToolbar's sortToggle switches between; the icon toggle itself replaces
// the old Select rendering (see the ListToolbar sortToggle prop below).
// In-memory only (resets on a full page reload) — see the upcomingOnly state in MatchList below.
let restoreShowPastOnReturn = false

const SORT_OPTIONS = [
  { value: 'matchDate,asc', label: 'Match date (soonest first)' },
  { value: 'matchDate,desc', label: 'Match date (latest first)' },
]

const SEARCH_DEBOUNCE_MS = 300

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
  }, [debouncedSearch, sort, sectionId, leagueId, seasonId, upcomingOnly])

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
    queryKey: ['managed-club', clubId, 'matches', page, debouncedSearch, sort, sectionId, leagueId, seasonId, upcomingOnly],
    queryFn: () =>
      listMatches(clubId as string, {
        page,
        sort,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(leagueId ? { leagueId } : {}),
        ...(seasonId ? { seasonId } : {}),
        upcomingOnly,
      }),
    enabled: Boolean(clubId),
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
    queryKey: ['managed-club', clubId, 'matches', 'filter-options', sectionId, leagueId, seasonId, debouncedSearch, upcomingOnly],
    queryFn: () =>
      listMatchFilterOptions(clubId as string, {
        sectionId: sectionId ?? undefined,
        leagueId: leagueId ?? undefined,
        seasonId: seasonId ?? undefined,
        search: debouncedSearch || undefined,
        upcomingOnly,
      }),
    enabled: Boolean(clubId),
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title={title}
        backTo={backTo}
        backLabel={backLabel}
        action={
          <Button onClick={onCreate ?? (() => navigate('/manage/fixtures/matches/new'))}>{createLabel}</Button>
        }
      />

      {/* docs/specs/043-list-toolbar-gold-standard.md: the bordered, shadowed background.paper
          surface this toolbar sits in (originally MatchList's own wrapping Box, per
          docs/specs/037-match-improvements.md items 3/4) now lives inside ListToolbar itself —
          every caller gets it automatically, nothing to wrap here anymore. The Section filter
          itself sits inline in ListToolbar's own filters slot rather than a second row below. */}
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by opponent or team name"
        searchOptions={searchSuggestions}
        sortToggle={{
          value: sort === 'matchDate,asc' ? 'asc' : 'desc',
          ascLabel: 'Match date, soonest first',
          descLabel: 'Match date, latest first',
          onToggle: () => setSort(sort === 'matchDate,asc' ? 'matchDate,desc' : 'matchDate,asc'),
        }}
        filters={
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <SectionTreeSelect
              label="Section"
              sections={filterableSections}
              value={sectionId}
              onChange={setSectionId}
              allowClear
            />
            <Input select label="League" value={leagueId ?? ''} onChange={(event) => setLeagueId(event.target.value || null)}>
              <MenuItem value="">All leagues</MenuItem>
              {filterableLeagues.map((league) => (
                <MenuItem key={league.id} value={league.id}>
                  {league.name}
                </MenuItem>
              ))}
            </Input>
            <Input select label="Season" value={seasonId ?? ''} onChange={(event) => setSeasonId(event.target.value || null)}>
              <MenuItem value="">All seasons</MenuItem>
              {filterableSeasons.map((season) => (
                <MenuItem key={season.id} value={season.id}>
                  {season.label}
                </MenuItem>
              ))}
            </Input>
            <FormControlLabel
              control={<Switch checked={!upcomingOnly} onChange={(event) => setUpcomingOnly(!event.target.checked)} />}
              label="Show past matches"
              sx={{ whiteSpace: 'nowrap', mr: 0 }}
            />
          </Stack>
        }
        filtersMinWidth={180}
      />

      {hasMatches && (
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
              ? 'Nothing scheduled ahead. Turn on "Show past matches" to see earlier fixtures, or schedule a new one.'
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
