import { useEffect, useMemo, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { TeamSheetCommunicationDialog } from '../../components/TeamSheetCommunicationDialog'
import type { TeamSheetPrintScope } from '../../components/TeamSheetCommunicationDialog'
import { listMatches, deactivateMatch, reactivateMatch } from '../../api/matchApi'
import type { Match } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { listMatchSides } from '../../api/matchSideApi'
import { listSquad } from '../../api/teamSquadApi'
import { matchFields } from '../../utils/matchRecordFields'
import { generateTeamSheetPdf } from '../../utils/teamSheetPdf'
import type { TeamSheetSide } from '../../utils/teamSheetPdf'

const SORT_OPTIONS = [
  { value: 'matchDate,desc', label: 'Match date (newest first)' },
  { value: 'matchDate,asc', label: 'Match date (oldest first)' },
]

const SEARCH_DEBOUNCE_MS = 300

function sideName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

function badgeFor(match: Match): RecordCardBadge | undefined {
  if (!match.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// A lightweight stand-in Team for a free-text opponent side (no real Team record exists) — only
// `logoUrl`/`name` are ever read from a TeamSheetSide's `team` by teamSheetPdf.ts/
// TeamSheetCommunicationDialog, both of which prefer `teamName` for display anyway.
function placeholderTeam(clubId: string, name: string): Team {
  return {
    id: '',
    clubId,
    sectionId: '',
    name,
    logoUrl: null,
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

// One RecordCard per match, each with its own deactivate/reactivate mutation — mirrors
// SponsorList.tsx's SponsorCard pattern, so one card's pending state never leaks onto another's.
function MatchCard({
  clubId,
  match,
  teamsById,
  leaguesById,
  seasonsById,
  editTo,
}: {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  editTo: string
}) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })

  const deactivate = useMutation({
    mutationFn: () => deactivateMatch(clubId, match.id),
    onSuccess: invalidate,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateMatch(clubId, match.id),
    onSuccess: invalidate,
  })

  const toggle = match.active ? deactivate : reactivate
  const homeTeamName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayTeamName = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const title = `${homeTeamName} vs ${awayTeamName}`

  // docs/specs/030-team-sheet-communication.md — "Communicate Team Sheet" data-fetching lives
  // here (the host page), not inside TeamSheetCommunicationDialog itself, matching this
  // codebase's existing LinkExistingRecordDialog/CreateAndLinkRecordDialog convention of a
  // presentational dialog fed by the caller's own React Query state. Every query is
  // `enabled: dialogOpen` so nothing fires until the admin actually opens the dialog.
  const sidesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', match.id, 'sides'],
    queryFn: () => listMatchSides(clubId, match.id),
    enabled: dialogOpen,
  })

  // Same query-key shape as MatchFormPage.tsx's MatchSideTab, so both share one cache entry per
  // team/season squad rather than each maintaining its own copy.
  const homeSquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', match.homeTeamId as string, 'seasons', match.seasonId, 'squad'],
    queryFn: () => listSquad(clubId, match.homeTeamId as string, match.seasonId),
    enabled: dialogOpen && Boolean(match.homeTeamId),
  })

  const awaySquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', match.awayTeamId as string, 'seasons', match.seasonId, 'squad'],
    queryFn: () => listSquad(clubId, match.awayTeamId as string, match.seasonId),
    enabled: dialogOpen && Boolean(match.awayTeamId),
  })

  const sidesLoading =
    dialogOpen &&
    (sidesQuery.isLoading ||
      (Boolean(match.homeTeamId) && homeSquadQuery.isLoading) ||
      (Boolean(match.awayTeamId) && awaySquadQuery.isLoading))

  // A fixed 2-tuple (home, then away) — TeamSheetCommunicationDialog's own prop type relies on
  // this exact order/length, per its "index 0 is home, index 1 is away" invariant.
  const teamSheetSides: [TeamSheetSide, TeamSheetSide] = [
    {
      team: (match.homeTeamId && teamsById.get(match.homeTeamId)) || placeholderTeam(clubId, homeTeamName),
      teamName: homeTeamName,
      side: sidesQuery.data?.find((side) => side.teamId === match.homeTeamId),
      squad: homeSquadQuery.data ?? [],
    },
    {
      team: (match.awayTeamId && teamsById.get(match.awayTeamId)) || placeholderTeam(clubId, awayTeamName),
      teamName: awayTeamName,
      side: sidesQuery.data?.find((side) => side.teamId === match.awayTeamId),
      squad: awaySquadQuery.data ?? [],
    },
  ]

  const subtitle = matchFields(match, leaguesById, seasonsById)
    .map((field) => String(field.value))
    .join(' · ')

  const handlePrint = async (scope: TeamSheetPrintScope) => {
    const filteredSides =
      scope === 'both' ? teamSheetSides : scope === 'home' ? [teamSheetSides[0]] : [teamSheetSides[1]]
    const url = await generateTeamSheetPdf(match, filteredSides, subtitle)
    window.open(url, '_blank')
  }

  return (
    <>
      <RecordCard
        title={title}
        avatar={{ fallback: <SportsCricketOutlinedIcon fontSize="small" />, shape: 'rounded' }}
        badge={badgeFor(match)}
        fields={matchFields(match, leaguesById, seasonsById)}
        editLabel="Edit"
        editTo={editTo}
        secondaryAction={{
          label: match.active ? 'Deactivate' : 'Reactivate',
          pendingLabel: match.active ? 'Deactivating…' : 'Reactivating…',
          pending: toggle.isPending,
          onClick: () => toggle.mutate(),
          icon: match.active ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />,
        }}
        secondaryActions={[
          {
            label: 'Communicate Team Sheet',
            pendingLabel: 'Opening…',
            pending: false,
            onClick: () => setDialogOpen(true),
            icon: <ShareOutlinedIcon fontSize="small" />,
          },
        ]}
      />
      <TeamSheetCommunicationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        match={match}
        sides={teamSheetSides}
        sidesLoading={Boolean(sidesLoading)}
        onPrint={handlePrint}
      />
    </>
  )
}

export interface MatchListProps {
  // SquadPicker (docs/specs/029-league-management.md) reuses this same paginated data source and
  // card shape, but routes each card's primary action into that match's Playing XI tab instead of
  // Details — a different entry point onto the same underlying Match data, not a second list.
  title?: string
  backTo?: string
  backLabel?: string
  createLabel?: string
  editTo?: (matchId: string) => string
  onCreate?: () => void
}

// Reads clubId from ManagerHome's Outlet context. The first paginated list in this feature area
// (docs/standards/frontend.md's pagination rule) — a club's match history grows every week across
// every season, unlike Section/Team/Sponsor's small, bounded lists.
export default function MatchList({
  title = 'Matches',
  backTo = '/manage/fixtures',
  backLabel = 'Back to Fixtures & Results',
  createLabel = 'Add Match',
  editTo = (matchId: string) => `/manage/fixtures/matches/${matchId}/edit`,
  onCreate,
}: MatchListProps) {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  // Note: the real backend GET /matches endpoint (docs/specs/029-league-management.md's API
  // Contract, MatchController.java) is Pageable-only — it has no `search` query param today.
  // This is still wired exactly like ProductList's own backend-driven search (a harmless no-op
  // extra param today, zero frontend changes needed if/when the backend adds support) rather than
  // a client-side filter, per docs/standards/frontend.md's "never client-side" pagination rule.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, sort])

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'matches', page, debouncedSearch, sort],
    queryFn: () => listMatches(clubId as string, { page, sort, ...(debouncedSearch ? { search: debouncedSearch } : {}) }),
    enabled: Boolean(clubId),
  })

  const { data: teams } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
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
      <ManageScreenHeader title={title} backTo={backTo} backLabel={backLabel} />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by opponent or team name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel={createLabel}
        onCreate={onCreate ?? (() => navigate('/manage/fixtures/matches/new'))}
      />

      {hasMatches && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {data.content.map((match) => (
            <MatchCard
              key={match.id}
              clubId={clubId}
              match={match}
              teamsById={teamsById}
              leaguesById={leaguesById}
              seasonsById={seasonsById}
              editTo={editTo(match.id)}
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
        <EmptyState title="No matches yet" description="Schedule your club's first match to get started." />
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
