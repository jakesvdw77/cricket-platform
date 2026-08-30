import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { listTeamsForClub, deactivateTeam, reactivateTeam } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'

const SORT_OPTIONS = [{ value: 'name,asc', label: 'Name' }]

const CLUB_TEAMS_QUERY_KEY = (clubId?: string) => ['managed-club', clubId, 'teams']

function badgeFor(team: Team): RecordCardBadge | undefined {
  if (!team.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// One RecordCard per team, each with its own deactivate/reactivate mutation — mirrors
// ClubContactList.tsx's ClubContactCard pattern, so one card's pending state never leaks onto
// another's. Called directly with the team's own sectionId (every TeamDto already carries it) —
// no navigation into Club Structure needed.
function TeamCard({ clubId, team, sectionBreadcrumb }: { clubId: string; team: Team; sectionBreadcrumb: string }) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: CLUB_TEAMS_QUERY_KEY(clubId) })
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'sections', team.sectionId, 'teams'] })
  }

  const deactivate = useMutation({
    mutationFn: () => deactivateTeam(clubId, team.sectionId, team.id),
    onSuccess: invalidate,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateTeam(clubId, team.sectionId, team.id),
    onSuccess: invalidate,
  })

  const toggle = team.active ? deactivate : reactivate

  return (
    <RecordCard
      title={team.name}
      badge={badgeFor(team)}
      fields={[{ label: 'Section', value: sectionBreadcrumb }]}
      editLabel="Edit"
      editTo={`/manage/sections/${team.sectionId}/teams/${team.id}/edit`}
      secondaryAction={{
        label: team.active ? 'Deactivate' : 'Reactivate',
        pendingLabel: team.active ? 'Deactivating…' : 'Reactivating…',
        pending: toggle.isPending,
        onClick: () => toggle.mutate(),
      }}
    />
  )
}

// Reads clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md) only —
// no route param, unlike the section-scoped TeamList.tsx. This is the real screen 006's
// "Teams" ManagerDashboard nav card (/manage/teams) has been pointing at an EmptyState placeholder
// for. Two queries, joined client-side into a sectionId -> name map for display — same "flat,
// unpaginated, compose client-side" posture ClubStructure.tsx already uses for sections+contacts.
export default function TeamDirectory() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  const {
    data: teams,
    isLoading,
    isError,
  } = useQuery({
    queryKey: CLUB_TEAMS_QUERY_KEY(clubId),
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

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

  const sectionBreadcrumbFor = (sectionId: string): string => {
    const section = sectionsById.get(sectionId)
    if (!section) {
      return 'Unknown section'
    }
    return [...breadcrumbFor(section, sectionsById), section.name].join(' › ')
  }

  const visibleTeams = useMemo(() => {
    if (!teams) {
      return []
    }

    const term = search.trim().toLowerCase()
    const filtered = term ? teams.filter((team) => team.name.toLowerCase().includes(term)) : teams

    const [, direction] = sort.split(',') as ['name', 'asc' | 'desc']
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

    return direction === 'desc' ? sorted.reverse() : sorted
  }, [teams, search, sort])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !teams) {
    return (
      <EmptyState
        title="Couldn't load teams"
        description="Something went wrong loading your club's teams. Please try again."
      />
    )
  }

  const hasTeams = teams.length > 0
  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Teams" />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Team"
        onCreate={() => navigate('/manage/teams/new')}
      />

      {visibleTeams.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visibleTeams.map((team) => (
            <TeamCard
              key={team.id}
              clubId={clubId}
              team={team}
              sectionBreadcrumb={sectionBreadcrumbFor(team.sectionId)}
            />
          ))}
        </Box>
      )}

      {visibleTeams.length === 0 && isSearching && (
        <EmptyState
          title="No matching teams"
          description={`No teams match "${search.trim()}". Try a different search.`}
        />
      )}

      {!hasTeams && !isSearching && (
        <EmptyState title="No teams yet" description="Add your club's first team to get started." />
      )}
    </Box>
  )
}
