import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge, RecordCardField } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { listPlayers, deactivatePlayer, reactivatePlayer } from '../../api/playerApi'
import type { Player } from '../../api/playerApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { initialsFromName } from '../../utils/initials'

const SORT_OPTIONS = [{ value: 'name,asc', label: 'Name' }]

function fullName(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

function badgeFor(player: Player): RecordCardBadge | undefined {
  if (!player.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// Only pushes a field when the value is present — mirrors sponsorRecordFields.ts's own
// conditional-push shape (docs/specs/023-sponsors.md), applied here to Player's identifying
// fields instead of Sponsor's.
function playerRecordFields(player: Player): RecordCardField[] {
  const fields: RecordCardField[] = []
  if (player.dateOfBirth) {
    fields.push({ label: 'Date of birth', value: player.dateOfBirth })
  }
  if (player.clubMembershipNumber) {
    fields.push({ label: 'Membership number', value: player.clubMembershipNumber })
  }
  return fields
}

// One RecordCard per player, each with its own deactivate/reactivate mutation — mirrors
// ClubContactList.tsx's ClubContactCard pattern, so one card's pending state never leaks onto
// another's.
function PlayerCard({ clubId, player, sectionNames }: { clubId: string; player: Player; sectionNames: string[] }) {
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'players'] })

  const deactivate = useMutation({
    mutationFn: () => deactivatePlayer(clubId, player.id),
    onSuccess: invalidate,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivatePlayer(clubId, player.id),
    onSuccess: invalidate,
  })

  const toggle = player.active ? deactivate : reactivate

  return (
    <RecordCard
      title={fullName(player)}
      avatar={{ imageUrl: player.photoUrl, fallback: initialsFromName(fullName(player)), shape: 'circular' }}
      badge={badgeFor(player)}
      fields={playerRecordFields(player)}
      chips={sectionNames}
      editLabel="Edit"
      editTo={`/manage/players/${player.id}/edit`}
      secondaryAction={{
        label: player.active ? 'Deactivate' : 'Reactivate',
        pendingLabel: player.active ? 'Deactivating…' : 'Reactivating…',
        pending: toggle.isPending,
        onClick: () => toggle.mutate(),
        icon: player.active ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />,
      }}
    />
  )
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
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  const {
    data: players,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'players'],
    queryFn: () => listPlayers(clubId as string),
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
      <ManageScreenHeader title="Players" />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Player"
        onCreate={() => navigate('/manage/players/new')}
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
            <PlayerCard key={player.id} clubId={clubId} player={player} sectionNames={sectionNamesFor(player)} />
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
