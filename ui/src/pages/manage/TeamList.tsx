import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { listTeamsForSection } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { initialsFromName } from '../../utils/initials'

const SORT_OPTIONS = [{ value: 'name,asc', label: 'Name' }]

const TEAMS_QUERY_KEY = (clubId?: string, sectionId?: string) => ['managed-club', clubId, 'sections', sectionId, 'teams']

function badgeFor(team: Team): RecordCardBadge | undefined {
  if (!team.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// One RecordCard per team — Deactivate/Reactivate now lives on TeamFormPage's own actions bar
// (docs/specs/038-move-deactivate-to-edit-screen.md), not here; this card is a read-only summary
// with "View" as its only footer action.
function TeamCard({ sectionId, team }: { sectionId: string; team: Team }) {
  return (
    <RecordCard
      title={team.name}
      avatar={{ imageUrl: team.logoUrl, fallback: initialsFromName(team.name), shape: 'rounded' }}
      badge={badgeFor(team)}
      viewTo={`/manage/sections/${sectionId}/teams/${team.id}`}
    />
  )
}

// Reads sectionId from the route and clubId from ManagerHome's Outlet context (docs/specs/
// 020-club-manager-access.md), same guard pattern as SponsorContactList.tsx. Deliberately no
// pagination state — a section's teams are a small, bounded list (docs/specs/026-teams.md),
// fetched in full and filtered/sorted client-side. Also fetches the club's sections (already
// cached elsewhere via the same query key ClubStructure.tsx uses) purely to show this section's
// own name in the page header — no new endpoint.
export default function TeamList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { sectionId } = useParams<{ sectionId: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  const {
    data: teams,
    isLoading,
    isError,
  } = useQuery({
    queryKey: TEAMS_QUERY_KEY(clubId, sectionId),
    queryFn: () => listTeamsForSection(clubId as string, sectionId as string),
    enabled: Boolean(clubId) && Boolean(sectionId),
  })

  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const section = sections?.find((candidate) => candidate.id === sectionId)

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(sections ?? []).forEach((candidate) => map.set(candidate.id, candidate))
    return map
  }, [sections])

  const breadcrumb = section ? breadcrumbFor(section, sectionsById) : []

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

  if (!sectionId) {
    return <EmptyState title="Not found" description="No section was specified." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !teams) {
    return (
      <EmptyState
        title="Couldn't load teams"
        description="Something went wrong loading this section's teams. Please try again."
      />
    )
  }

  const hasTeams = teams.length > 0
  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title={section ? `Teams — ${[...breadcrumb, section.name].join(' › ')}` : 'Teams'}
        backTo="/manage/sections"
        backLabel="Back to Club Structure"
      />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Team"
        onCreate={() => navigate(`/manage/sections/${sectionId}/teams/new`)}
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
            <TeamCard key={team.id} sectionId={sectionId} team={team} />
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
        <EmptyState title="No teams yet" description="Add this section's first team to get started." />
      )}
    </Box>
  )
}
