import { useMemo, useState } from 'react'
import { Box, Link, Typography } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { PlayerCard } from '../../components/PlayerCard'
import { Button } from '../../components/Button'
import { CompactSwitch } from '../../components/CompactSwitch'
import { ContentControlsLine, SortLink } from '../../components/ContentControlsLine'
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

// Reads clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same guard pattern as every
// other /manage list. Deliberately no pagination state - a club's players are a small, bounded list (docs/specs/028-
// players.md's API Contract), fetched in full and searched by name client-side, unlike MatchList's backend pagination.
// docs/specs/088: the Matches pattern - four clickable counters over a FilterBar and a content line, every filter a
// backend parameter except the name search, so the counters and the list always agree.
export default function PlayerList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortAscending, setSortAscending] = useState(true)
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
  const { seasonId } = useAvailabilitySeason(clubId)
  const statusActions = usePlayerStatusActions(clubId)

  const { data: players, isLoading, isError } = useQuery({
    queryKey: ['managed-club', clubId, 'players', sectionId, missingDateOfBirth, showInactive, focus, seasonId],
    queryFn: () =>
      listPlayers(clubId as string, {
        sectionId: sectionId ?? undefined,
        missingDateOfBirth: missingDateOfBirth || undefined,
        includeInactive: showInactive,
        focus: focus ?? undefined,
        seasonId: focus === 'in-squad' || focus === 'selected' ? seasonId : undefined,
      }),
    enabled: Boolean(clubId) && (focus !== 'in-squad' && focus !== 'selected' ? true : Boolean(seasonId)),
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
    const sorted = [...filtered].sort((a, b) => fullName(a).localeCompare(fullName(b)))
    return sortAscending ? sorted : sorted.reverse()
  }, [players, search, sortAscending])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
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
  const inactiveToggle = <CompactSwitch checked={showInactive} onChange={setShowInactive} label="Show suspended and rejected players" />
  const sortLink = <SortLink label={sortAscending ? 'A to Z' : 'Z to A'} onToggle={() => setSortAscending((current) => !current)} />

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
            {missingToggle}
            {inactiveToggle}
          </>
        }
      />

      {visiblePlayers.length > 0 && (
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
