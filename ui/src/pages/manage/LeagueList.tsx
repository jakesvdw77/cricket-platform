import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge, RecordCardField } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { Button } from '../../components/Button'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'

// Exported for LeagueDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md) so the
// new read-only view screen's badge/fields/chips match this card's exactly, rather than a second
// copy.
export function badgeFor(league: League): RecordCardBadge | undefined {
  if (!league.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// docs/specs/050-league-schedule-and-fixtures.md: two badges reflecting the club's own current
// Season — team-count always present, season-label only when the club has a current season at all
// (omitted entirely rather than rendered blank). Coexists with badgeFor's own single Active/
// Inactive `badge`, per 040's existing badge+badges co-rendering.
export function leagueSeasonBadges(league: League): RecordCardBadge[] {
  const badges: RecordCardBadge[] = [
    {
      label: `${league.currentSeasonTeamCount} team${league.currentSeasonTeamCount === 1 ? '' : 's'}`,
      tone: 'neutral',
    },
  ]
  if (league.currentSeasonLabel) {
    badges.push({ label: league.currentSeasonLabel, tone: 'muted' })
  }
  return badges
}

export function leagueRecordFields(league: League): RecordCardField[] {
  const fields: RecordCardField[] = [{ label: 'Playing XI size', value: league.maxPlayingXiSize }]
  if (league.minAge != null || league.maxAge != null) {
    fields.push({
      label: 'Age range',
      value: `${league.minAge ?? 'Any'}–${league.maxAge ?? 'Any'}`,
    })
  }
  return fields
}

export function leagueChips(league: League): string[] {
  const chips: string[] = []
  if (league.allowSubstitutions) {
    chips.push('Substitutions allowed')
  }
  return chips
}

// One RecordCard per league — Deactivate/Reactivate now lives on LeagueFormPage's own actions bar
// (docs/specs/038-move-deactivate-to-edit-screen.md), not here; this card is a read-only summary
// with "View" as its only footer action.
function LeagueCard({ league }: { league: League }) {
  return (
    <RecordCard
      title={league.name}
      avatar={{ fallback: <EmojiEventsOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badge={badgeFor(league)}
      badges={leagueSeasonBadges(league)}
      fields={leagueRecordFields(league)}
      chips={leagueChips(league)}
      viewTo={`/manage/fixtures/leagues/${league.id}`}
      editTo={`/manage/fixtures/leagues/${league.id}/edit`}
      secondaryActions={[
        ...(league.currentSeasonPlayingConditionsUrl
          ? [
              {
                label: 'Playing Conditions',
                pendingLabel: 'Opening…',
                pending: false,
                onClick: () => window.open(league.currentSeasonPlayingConditionsUrl as string, '_blank'),
                icon: <DescriptionOutlinedIcon fontSize="small" />,
              },
            ]
          : []),
      ]}
    />
  )
}

// Reads clubId from ManagerHome's Outlet context, same guard pattern as every other /manage list.
// Deliberately no pagination state — a club's own leagues are a small, bounded list, matching
// Section/Team/Sponsor's own posture (docs/specs/029-league-management.md).
export default function LeagueList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name,asc')

  const {
    data: leagues,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
  })

  const visibleLeagues = useMemo(() => {
    if (!leagues) {
      return []
    }

    const term = search.trim().toLowerCase()
    const filtered = term ? leagues.filter((league) => league.name.toLowerCase().includes(term)) : leagues

    const [, direction] = sort.split(',') as ['name', 'asc' | 'desc']
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

    return direction === 'desc' ? sorted.reverse() : sorted
  }, [leagues, search, sort])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !leagues) {
    return (
      <EmptyState
        title="Couldn't load leagues"
        description="Something went wrong loading your club's leagues. Please try again."
      />
    )
  }

  const hasLeagues = leagues.length > 0
  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Leagues"
        backTo="/manage/fixtures"
        backLabel="Back to Fixtures"
        action={<Button onClick={() => navigate('/manage/fixtures/leagues/new')}>Add League</Button>}
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
      />

      {visibleLeagues.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visibleLeagues.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </Box>
      )}

      {visibleLeagues.length === 0 && isSearching && (
        <EmptyState
          title="No matching leagues"
          description={`No leagues match "${search.trim()}". Try a different search.`}
        />
      )}

      {!hasLeagues && !isSearching && (
        <EmptyState title="No leagues yet" description="Create your club's first league to get started." />
      )}
    </Box>
  )
}
