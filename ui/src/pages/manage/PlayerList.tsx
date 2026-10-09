import { useMemo, useState } from 'react'
import { Box, Link, Typography } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { PlayerCard } from '../../components/PlayerCard'
import { PlayerTable } from '../../components/PlayerTable'
import { ListViewToggle } from '../../components/ListViewToggle'
import { Button } from '../../components/Button'
import { CompactSwitch } from '../../components/CompactSwitch'
import { ContentControlsLine, SortMenu } from '../../components/ContentControlsLine'
import type { SortMenuOption } from '../../components/ContentControlsLine'
import { EmptyState } from '../../components/EmptyState'
import { FilterBar } from '../../components/FilterBar'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { PageCounters } from '../../components/PageCounters'
import type { PageCounterItem } from '../../components/PageCounters'
import { getPlayersSummary, listPlayers, playersSummaryKey } from '../../api/playerApi'
import type { Player, PlayerListFocus, PlayersSummaryFilters } from '../../api/playerApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'
import { useAvailabilitySeason } from '../../hooks/useAvailabilitySeason'
import { useListViewPreference } from '../../hooks/useListViewPreference'
import { usePlayerStatusActions } from '../../hooks/usePlayerStatusActions'
import { scopeFilterText } from '../../utils/availabilityScope'
import { cardGridSx } from '../../utils/cardGrid'

// Exported for PlayerDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md) so the
// new read-only view screen's title matches this card's exactly, rather than a second copy.
export function fullName(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

// docs/specs/088-players-polls-alignment.md: the quick filters behind the counters, named as the chip, the scope text and
// the phone sheet's Quick filter row show them.
const FOCUS_LABELS: Record<PlayerListFocus, string> = {
  'in-squad': 'In a squad this season',
  selected: 'Players selected this season',
  unverified: 'Unverified players',
}

// docs/specs/088: the orders the sort menu offers. Name is the default; "games this season" puts the busiest (or the
// idlest) players first, with the name as the tie-break so equal counts keep a stable order.
type PlayerSort = 'name-asc' | 'name-desc' | 'season-desc' | 'season-asc'

const SORT_OPTIONS: (SortMenuOption & { value: PlayerSort })[] = [
  { value: 'name-asc', label: 'Name, A to Z', linkLabel: 'A to Z' },
  { value: 'name-desc', label: 'Name, Z to A', linkLabel: 'Z to A' },
  { value: 'season-desc', label: 'Games this season, most first', linkLabel: 'most games' },
  { value: 'season-asc', label: 'Games this season, fewest first', linkLabel: 'fewest games' },
]

function comparePlayers(sort: PlayerSort): (a: Player, b: Player) => number {
  const byName = (a: Player, b: Player) => fullName(a).localeCompare(fullName(b))
  switch (sort) {
    case 'name-desc':
      return (a, b) => byName(b, a)
    case 'season-desc':
      return (a, b) => b.gamesThisSeason - a.gamesThisSeason || byName(a, b)
    case 'season-asc':
      return (a, b) => a.gamesThisSeason - b.gamesThisSeason || byName(a, b)
    default:
      return byName
  }
}

// Reads clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same guard pattern as every
// other /manage list. Deliberately no pagination state - a club's players are a small, bounded list (docs/specs/028-
// players.md's API Contract), fetched in full and searched by name client-side, unlike MatchList's backend pagination.
// docs/specs/088: the Matches pattern - four clickable counters over a FilterBar and a content line, every filter a
// backend parameter except the name search, so the counters and the list always agree.
export default function PlayerList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<PlayerSort>('name-asc')
  // docs/specs/035-section-scoped-access.md: an optional, further-narrowing filter on top of whatever the caller's own
  // access already resolves server-side. docs/specs/043: persisted across visits; Search stays a separate, non-persisted
  // useState above. docs/specs/077: show only the players still missing a date of birth, to fix them.
  const [{ sectionId, missingDateOfBirth }, setFilters] = usePersistedListFilters(`playerList:filters:${clubId}`, {
    sectionId: null as string | null,
    missingDateOfBirth: false,
  })
  // Per visit only: suspended and rejected players are hidden by default, and the counters' quick filter (at most one).
  const [showInactive, setShowInactive] = useState(false)
  const [focus, setFocus] = useState<PlayerListFocus | null>(null)
  // The two season counters look at the default season (the one containing today, else the latest); there is no control.
  const { seasonId, seasonsLoading } = useAvailabilitySeason(clubId)
  // docs/specs/088 (F): Cards or List, remembered per page in the browser (`playerList:view`, default Cards). It changes
  // only how the same players are shown: the filters, counters and Status actions are identical in both views.
  const [view, setView] = useListViewPreference('playerList:view')
  const statusActions = usePlayerStatusActions(clubId)

  const { data: players, isPending, isError } = useQuery({
    queryKey: ['managed-club', clubId, 'players', sectionId, missingDateOfBirth, showInactive, focus, seasonId],
    queryFn: () =>
      listPlayers(clubId as string, {
        sectionId: sectionId ?? undefined,
        missingDateOfBirth: missingDateOfBirth || undefined,
        includeInactive: showInactive,
        focus: focus ?? undefined,
        // docs/specs/088 (E): every request carries the default season, so each card's "this season" is right on first paint
        seasonId: seasonId ?? undefined,
      }),
    // wait for the seasons query (otherwise the first fetch has no season and a second one follows); a season focus also
    // needs a season to exist
    enabled: Boolean(clubId) && !seasonsLoading && (focus !== 'in-squad' && focus !== 'selected' ? true : Boolean(seasonId)),
    // Keep the previous list on screen while a filter or counter change loads, so the toolbar and counters stay mounted.
    placeholderData: keepPreviousData,
  })

  // The counters follow the list's filters (Section, Missing date of birth, the Show switch); the name search and the
  // quick filter itself do not narrow them, so the first card stays a meaningful way back. A failed request hides the
  // row; the list still works.
  const summaryFilters: PlayersSummaryFilters = {
    sectionId: sectionId ?? undefined,
    missingDateOfBirth: missingDateOfBirth || undefined,
    includeInactive: showInactive,
    seasonId: seasonId ?? undefined,
  }
  const summaryQuery = useQuery({
    queryKey: playersSummaryKey(clubId ?? '', summaryFilters),
    queryFn: () => getPlayersSummary(clubId as string, summaryFilters),
    enabled: Boolean(clubId),
    retry: false,
    placeholderData: keepPreviousData,
  })

  // Fetched once, joined client-side against each player's bare sectionIds to resolve chip labels - the same "fetch the
  // full section list once, join names client-side" pattern TeamDirectory.tsx already uses.
  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(sections ?? []).forEach((section) => map.set(section.id, section))
    return map
  }, [sections])

  const sectionNamesFor = (player: Player): string[] =>
    player.sectionIds
      .map((id) => sectionsById.get(id)?.name)
      .filter((name): name is string => Boolean(name))

  const visiblePlayers = useMemo(() => {
    if (!players) {
      return []
    }
    const term = search.trim().toLowerCase()
    const filtered = term ? players.filter((player) => fullName(player).toLowerCase().includes(term)) : players
    return [...filtered].sort(comparePlayers(sort))
  }, [players, search, sort])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  // isPending (not isLoading): the list query also waits for the seasons query, and that wait is still loading
  if (isPending) {
    return null
  }

  if (isError || !players) {
    return (
      <EmptyState
        title="Couldn't load players"
        description="Something went wrong loading your club's players. Please try again."
      />
    )
  }

  const hasPlayers = players.length > 0
  const isSearching = search.trim().length > 0
  const scope = scopeFilterText({ sections: sections ?? [], sectionId })
  // Choosing the active counter again turns its filter off; choosing another replaces it.
  const toggleFocus = (next: PlayerListFocus) => setFocus((current) => (current === next ? null : next))
  const summary = summaryQuery.data
  const counters: PageCounterItem[] = summary
    ? [
        {
          id: 'shown',
          value: summary.playersShown,
          label: showInactive ? 'Players shown' : 'Active players',
          shortLabel: showInactive ? 'Shown' : 'Active',
          kind: 'filter',
          active: focus === null,
          hint: 'Show all',
          onSelect: () => setFocus(null),
        },
        {
          id: 'in-squad',
          value: summary.inSquad,
          label: FOCUS_LABELS['in-squad'],
          shortLabel: 'In a squad',
          kind: 'filter',
          active: focus === 'in-squad',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('in-squad'),
        },
        {
          id: 'selected',
          value: summary.selected,
          label: FOCUS_LABELS.selected,
          shortLabel: 'Selected',
          kind: 'filter',
          active: focus === 'selected',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('selected'),
        },
        {
          id: 'unverified',
          value: summary.unverified,
          label: FOCUS_LABELS.unverified,
          shortLabel: 'Unverified',
          tone: summary.unverified > 0 ? 'warning' : 'default',
          kind: 'filter',
          active: focus === 'unverified',
          hint: 'Tap to filter',
          onSelect: () => toggleFocus('unverified'),
        },
      ]
    : []
  const showCounters = !summaryQuery.isError && (summaryQuery.isPending || Boolean(summary))

  const missingToggle = (
    <CompactSwitch
      checked={missingDateOfBirth}
      onChange={(checked) => setFilters({ missingDateOfBirth: checked })}
      label="Missing date of birth"
    />
  )
  const inactiveToggle = <CompactSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
  const sortLink = <SortMenu value={sort} options={SORT_OPTIONS} onChange={(value) => setSort(value as PlayerSort)} />

  const chips = [
    ...(focus ? [{ key: 'focus', label: FOCUS_LABELS[focus], onRemove: () => setFocus(null) }] : []),
    ...(missingDateOfBirth
      ? [{ key: 'missing-dob', label: 'Missing date of birth', onRemove: () => setFilters({ missingDateOfBirth: false }) }]
      : []),
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Players"
        // docs/specs/088: the scope of the list under the title when a section is set, as on Matches and Availability.
        subtitle={scope ? `Showing: ${scope}` : undefined}
        action={<Button onClick={() => navigate('/manage/players/new')}>Add Player</Button>}
      />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <FilterBar
        density="compact"
        sections={sections ?? []}
        sectionId={sectionId}
        onSectionChange={(value) => setFilters({ sectionId: value })}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        extraChips={chips}
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
            {missingToggle}
            {inactiveToggle}
            {sortLink}
          </>
        }
        onClearAll={() => {
          setFilters({ sectionId: null, missingDateOfBirth: false })
          setFocus(null)
        }}
      />

      <ContentControlsLine
        scope={`Showing ${players.length} ${players.length === 1 ? 'player' : 'players'}${focus ? ` · ${FOCUS_LABELS[focus]}` : ''}`}
        sortAction={sortLink}
        controls={
          <>
            <ListViewToggle value={view} onChange={setView} />
            {missingToggle}
            {inactiveToggle}
          </>
        }
      />

      {visiblePlayers.length > 0 && view === 'list' && (
        <PlayerTable
          players={visiblePlayers}
          sectionNamesFor={sectionNamesFor}
          viewTo={(player) => `/manage/players/${player.id}`}
          onStatusAction={(player, action) => statusActions.requestAction(player, action)}
        />
      )}

      {visiblePlayers.length > 0 && view === 'cards' && (
        <Box sx={cardGridSx}>
          {visiblePlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              sectionNames={sectionNamesFor(player)}
              viewTo={`/manage/players/${player.id}`}
              editTo={`/manage/players/${player.id}/edit`}
              onStatusAction={(action) => statusActions.requestAction(player, action)}
            />
          ))}
        </Box>
      )}

      {visiblePlayers.length === 0 && isSearching && (
        <EmptyState
          title="No matching players"
          description={`No players match "${search.trim()}". Try a different search.`}
        />
      )}

      {!hasPlayers && !isSearching && focus && (
        <EmptyState title="Nobody here" description={`No players match "${FOCUS_LABELS[focus]}" with the current filters.`} />
      )}

      {!hasPlayers && !isSearching && !focus && missingDateOfBirth && (
        <EmptyState title="Every player has a date of birth" description="There is nobody left to fix." />
      )}

      {!hasPlayers && !isSearching && !focus && !missingDateOfBirth && (
        <EmptyState title="No players yet" description="Add your club's first player to get started." />
      )}

      {statusActions.dialog}
    </Box>
  )
}
