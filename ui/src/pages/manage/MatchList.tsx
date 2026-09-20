import { useEffect, useMemo, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { TeamSheetCommunicationDialog } from '../../components/TeamSheetCommunicationDialog'
import type { TeamSheetPrintScope } from '../../components/TeamSheetCommunicationDialog'
import { listMatches } from '../../api/matchApi'
import type { Match } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { listSections } from '../../api/sectionApi'
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

// docs/specs/037-match-improvements.md item 2: SquadPicker.tsx (029) already passes an `editTo`
// that itself ends in `?tab=playing-xi` — a naive `${editTo}?tab=playing-xi` would double up the
// query string (`?tab=playing-xi?tab=playing-xi`, which MatchFormPage's own `searchParams.get`
// read would then fail to match exactly). Skips entirely when already present, else appends with
// `&` when a (different) query string already exists.
function withPlayingXiTab(url: string): string {
  if (url.includes('tab=playing-xi')) {
    return url
  }
  return `${url}${url.includes('?') ? '&' : '?'}tab=playing-xi`
}

// Exported for MatchDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md) so the
// new read-only view screen's title/badge match this card's exactly, rather than a second copy.
export function sideName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

export function badgeFor(match: Match): RecordCardBadge | undefined {
  if (!match.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// docs/specs/040-announce-team.md: one badge per real-Team side (skipped entirely for a
// free-text opponent side, since there's nothing to announce), prefixed with that side's own
// resolved team name only when both sides are real Teams — unprefixed for the overwhelmingly
// common one-real-side case, since the card's own title already names both teams.
export function announcedBadges(match: Match, teamsById: Map<string, Team>): RecordCardBadge[] {
  const badges: RecordCardBadge[] = []
  const bothRealTeams = Boolean(match.homeTeamId) && Boolean(match.awayTeamId)

  if (match.homeTeamId) {
    const prefix = bothRealTeams ? `${sideName(match.homeTeamId, match.homeTeamName, teamsById)}: ` : ''
    badges.push(
      match.homeSideAnnounced
        ? { label: `${prefix}Announced`, tone: 'positive' }
        : { label: `${prefix}Not Announced`, tone: 'neutral' },
    )
  }

  if (match.awayTeamId) {
    const prefix = bothRealTeams ? `${sideName(match.awayTeamId, match.awayTeamName, teamsById)}: ` : ''
    badges.push(
      match.awaySideAnnounced
        ? { label: `${prefix}Announced`, tone: 'positive' }
        : { label: `${prefix}Not Announced`, tone: 'neutral' },
    )
  }

  return badges
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

// One RecordCard per match — Deactivate/Reactivate now lives on MatchFormPage's own actions bar
// (docs/specs/038-move-deactivate-to-edit-screen.md), not here; "Select Team"/"Communicate Team
// Sheet" remain the card's own secondaryActions, untouched.
function MatchCard({
  clubId,
  match,
  teamsById,
  leaguesById,
  seasonsById,
  editTo,
  viewTo,
}: {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  editTo: string
  // docs/specs/036-view-first-record-detail-screens.md: when present, the card's primary footer
  // action becomes "View" (into MatchDetailPage) and editTo is suppressed — SquadPicker.tsx
  // deliberately passes `undefined` here (via MatchList's own `viewTo={null}`) to keep its own
  // "jump straight to the Playing XI tab" edit shortcut, unchanged.
  viewTo?: string
}) {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)

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

  // docs/specs/037-match-improvements.md item 2: a match between two free-text opponents has no
  // Playing XI tab to jump into (029) — the shortcut is omitted entirely rather than shown
  // disabled or landing on an empty tab.
  const hasRealTeamSide = Boolean(match.homeTeamId) || Boolean(match.awayTeamId)

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
        badges={announcedBadges(match, teamsById)}
        fields={matchFields(match, leaguesById, seasonsById)}
        editLabel="Edit"
        editTo={editTo}
        viewTo={viewTo}
        secondaryActions={[
          ...(hasRealTeamSide
            ? [
                {
                  label: 'Select Team',
                  pendingLabel: 'Select Team',
                  pending: false,
                  onClick: () => navigate(withPlayingXiTab(editTo)),
                  icon: <GroupsOutlinedIcon fontSize="small" />,
                },
              ]
            : []),
          {
            label: 'Team Sheet',
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
        subtitle={subtitle}
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
  backTo = '/manage/fixtures',
  backLabel = 'Back to Fixtures',
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
  // docs/specs/037-match-improvements.md item 1: the list defaults to upcoming matches only — no
  // UI control to change it this pass (see spec's Non-goals). A future "Show past matches" toggle
  // is just flipping this boolean, so it's kept as real state (and in the query key below) rather
  // than a hard-coded inline `true`.
  const [upcomingOnly] = useState(true)

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
  }, [debouncedSearch, sort, sectionId])

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'matches', page, debouncedSearch, sort, sectionId, upcomingOnly],
    queryFn: () =>
      listMatches(clubId as string, {
        page,
        sort,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(sectionId ? { sectionId } : {}),
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
      <ManageScreenHeader
        title={title}
        backTo={backTo}
        backLabel={backLabel}
        action={
          <Button onClick={onCreate ?? (() => navigate('/manage/fixtures/matches/new'))}>{createLabel}</Button>
        }
      />

      {/* docs/specs/037-match-improvements.md items 3/4: ListToolbar + the Section filter read as
          one control group inside a bordered, shadowed container — a solid background.paper
          surface (not a translucent primary tint, which reads as invisible against the shell's
          own gradient page background) reads as a real surface floating above the page, matching
          RecordCard's identical fix for the same problem. The Section filter itself sits inline
          in ListToolbar's own filters slot rather than a second row below. */}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          boxShadow: 1,
          p: 2,
        }}
      >
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by opponent or team name"
          sortValue={sort}
          sortOptions={SORT_OPTIONS}
          onSortChange={setSort}
          sortMinWidth={260}
          filters={
            <SectionTreeSelect label="Section" sections={sections ?? []} value={sectionId} onChange={setSectionId} allowClear />
          }
          filtersMinWidth={180}
        />
      </Box>

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
