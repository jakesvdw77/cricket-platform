import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { Button } from '../../components/Button'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { initialsFromName } from '../../utils/initials'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'

const CLUB_TEAMS_QUERY_KEY = (clubId?: string) => ['managed-club', clubId, 'teams']

// Exported for TeamDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md) so the
// new read-only view screen's badge matches this card's exactly, rather than a second copy.
export function badgeFor(team: Team): RecordCardBadge | undefined {
  if (!team.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// One RecordCard per team — Deactivate/Reactivate now lives on TeamFormPage's own actions bar
// (docs/specs/038-move-deactivate-to-edit-screen.md), not here; this card is a read-only summary
// with "View" as its only footer action. Called directly with the team's own sectionId (every
// TeamDto already carries it) — no navigation into Club Structure needed.
function TeamCard({ team, sectionBreadcrumb }: { team: Team; sectionBreadcrumb: string }) {
  return (
    <RecordCard
      title={team.name}
      avatar={{ imageUrl: team.logoUrl, fallback: initialsFromName(team.name), shape: 'rounded' }}
      badge={badgeFor(team)}
      fields={[{ label: 'Section', value: sectionBreadcrumb }]}
      viewTo={`/manage/sections/${team.sectionId}/teams/${team.id}`}
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
  const [sort, setSort] = useState('name,asc')
  // docs/specs/035-section-scoped-access.md: an optional, further-narrowing filter on top of
  // whatever the caller's own access already resolves server-side by default.
  // docs/specs/043-list-toolbar-gold-standard.md: persisted across visits the same way MatchList's
  // own filters already are — Search stays a separate, non-persisted useState above.
  const [{ sectionId }, setFilters] = usePersistedListFilters(`teamDirectory:filters:${clubId}`, {
    sectionId: null as string | null,
  })

  const {
    data: teams,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [...CLUB_TEAMS_QUERY_KEY(clubId), sectionId],
    queryFn: () => listTeamsForClub(clubId as string, { sectionId: sectionId ?? undefined }),
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
      <ManageScreenHeader
        title="Teams"
        action={<Button onClick={() => navigate('/manage/teams/new')}>Add Team</Button>}
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

      {visibleTeams.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visibleTeams.map((team) => (
            <TeamCard key={team.id} team={team} sectionBreadcrumb={sectionBreadcrumbFor(team.sectionId)} />
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
