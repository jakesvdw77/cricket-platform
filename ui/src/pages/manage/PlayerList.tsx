import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { RecordCardBadge } from '../../components/RecordCard'
import { PlayerCard } from '../../components/PlayerCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { Button } from '../../components/Button'
import { listPlayers } from '../../api/playerApi'
import type { Player } from '../../api/playerApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'

// Exported for PlayerDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md) so the
// new read-only view screen's title/badge match this card's exactly, rather than a second copy.
export function fullName(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

export function badgeFor(player: Player): RecordCardBadge | undefined {
  if (!player.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// Reads clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same
// guard pattern as every other /manage list. Deliberately no pagination state — a club's players
// are a small, bounded list (docs/specs/028-players.md's API Contract), fetched in full and
// filtered/sorted client-side, unlike ProductList's backend-driven pagination. This is the real
// screen 006's "Players" ManagerDashboard nav card (/manage/players) has been pointing at an
// EmptyState placeholder for.
export default function PlayerList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name,asc')
  // docs/specs/035-section-scoped-access.md: an optional, further-narrowing filter on top of
  // whatever the caller's own access already resolves server-side by default — never what makes a
  // section-scoped admin's view scoped in the first place. docs/specs/043-list-toolbar-gold-
  // standard.md: persisted across visits the same way MatchList's own filters already are —
  // Search stays a separate, non-persisted useState above.
  const [{ sectionId }, setFilters] = usePersistedListFilters(`playerList:filters:${clubId}`, {
    sectionId: null as string | null,
  })

  const {
    data: players,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'players', sectionId],
    queryFn: () => listPlayers(clubId as string, { sectionId: sectionId ?? undefined }),
    enabled: Boolean(clubId),
  })

  // Fetched once, joined client-side against each player's bare sectionIds to resolve chip
  // labels — same "fetch the full section list once, join names client-side" pattern
  // TeamDirectory.tsx already uses for its own section-name join.
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
      .map((sectionId) => sectionsById.get(sectionId)?.name)
      .filter((name): name is string => Boolean(name))

  const visiblePlayers = useMemo(() => {
    if (!players) {
      return []
    }

    const term = search.trim().toLowerCase()
    const filtered = term ? players.filter((player) => fullName(player).toLowerCase().includes(term)) : players

    const [, direction] = sort.split(',') as ['name', 'asc' | 'desc']
    const sorted = [...filtered].sort((a, b) => fullName(a).localeCompare(fullName(b)))

    return direction === 'desc' ? sorted.reverse() : sorted
  }, [players, search, sort])

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Players"
        action={<Button onClick={() => navigate('/manage/players/new')}>Add Player</Button>}
      />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortToggle={{
          value: sort.endsWith(',asc') ? 'asc' : 'desc',
          ascLabel: 'Name, A to Z',
          descLabel: 'Name, Z to A',
          onToggle: () => setSort(sort.endsWith(',asc') ? 'name,desc' : 'name,asc'),
        }}
        filters={
          <SectionTreeSelect
            label="Section"
            sections={sections ?? []}
            value={sectionId}
            onChange={(value) => setFilters({ sectionId: value })}
            allowClear
          />
        }
      />

      {visiblePlayers.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visiblePlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              sectionNames={sectionNamesFor(player)}
              badge={badgeFor(player)}
              viewTo={`/manage/players/${player.id}`}
              editTo={`/manage/players/${player.id}/edit`}
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

      {!hasPlayers && !isSearching && (
        <EmptyState title="No players yet" description="Add your club's first player to get started." />
      )}
    </Box>
  )
}
