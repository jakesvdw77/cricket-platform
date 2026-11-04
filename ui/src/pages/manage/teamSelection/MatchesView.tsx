import { useMemo, useState } from 'react'
import { Alert, Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { BrandIcon } from '../../../components/BrandIcon'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { ListViewToggle } from '../../../components/ListViewToggle'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import type { TeamSelectionStatus } from '../../../api/teamSelectionApi'
import { useNavigate, useLocation } from 'react-router-dom'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { dynamicCardGridSx } from '../../../utils/cardGrid'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { SelectionMatchCard } from './SelectionMatchCard'
import { useTeamSelectionHub } from './hubContext'
import { matchesSearch } from './matchSearch'
import { sortMatchesByDate } from './sortMatches'
import { SelectionMatchesTable } from './SelectionMatchesTable'
import { TeamSelectionFilterBar } from './TeamSelectionFilterBar'
import { useAnnounceSide } from './useAnnounceSide'
import { useShareAnnouncedSide } from './useShareAnnouncedSide'
import { STATUS_LABELS } from './selectionStatus'

// docs/specs/093-team-selection-hub.md: the quick filter behind the counters. null shows every match; each counter
// equals its filter, because the figures and the rows come from the same overview response.
type Focus = TeamSelectionStatus

const FOCUS_ORDER: Focus[] = ['NOT_STARTED', 'IN_PROGRESS', 'READY_TO_ANNOUNCE', 'ANNOUNCED']

// The Matches view (docs/specs/137): counters (quick filters), then one flat toolbar (the shared filters, View Entire Season, Cards | List),
// fused into the table's card in List view and a standalone card above the cards in Cards view.
export default function MatchesView() {
  const { clubId, overview, showPast, search, sort, leagues } = useTeamSelectionHub()
  const [focus, setFocus] = useState<Focus | null>(null)
  const [view, setView] = useListViewPreference('teamSelection:matchesView', 'list')
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  const navigate = useNavigate()
  const location = useLocation()
  const announce = useAnnounceSide(clubId as string)
  const shareSide = useShareAnnouncedSide(clubId as string)

  const data = overview.data
  const term = search.trim().toLowerCase()
  const visible = useMemo(
    () => sortMatchesByDate((data?.matches ?? []).filter((match) => (focus === null || match.status === focus) && matchesSearch(match, term)), sort),
    [data, focus, term, sort],
  )

  if (overview.isError) {
    return <EmptyState title="Couldn't load team selection" description="Something went wrong loading the matches. Please try again." />
  }

  const counts = data?.counts
  const toggle = (next: Focus) => setFocus((current) => (current === next ? null : next))
  const countFor: Record<Focus, number | undefined> = {
    NOT_STARTED: counts?.notStarted,
    IN_PROGRESS: counts?.inProgress,
    READY_TO_ANNOUNCE: counts?.readyToAnnounce,
    ANNOUNCED: counts?.announced,
  }
  const counters: PageCounterItem[] = data
    ? [
        {
          id: 'shown',
          value: data.matches.length,
          label: showPast ? 'Matches Shown' : 'Upcoming Matches',
          shortLabel: showPast ? 'Shown' : 'Upcoming',
          kind: 'filter',
          active: focus === null,
          hint: 'Show all',
          onSelect: () => setFocus(null),
        },
        ...FOCUS_ORDER.map(
          (status): PageCounterItem => ({
            id: status.toLowerCase().replace(/_/g, '-'),
            value: countFor[status] ?? 0,
            label: STATUS_LABELS[status],
            tone: status === 'NOT_STARTED' && (countFor[status] ?? 0) > 0 ? 'warning' : 'default',
            kind: 'filter',
            active: focus === status,
            hint: 'Tap to filter',
            onSelect: () => toggle(status),
          }),
        ),
      ]
    : []

  const bar = (
    <TeamSelectionFilterBar
      sortable
      viewControls={phone ? <ListViewToggle value={view} onChange={setView} fullWidth /> : <ListViewToggle value={view} onChange={setView} variant="toolbar" />}
    />
  )
  const total = visible.length
  const filtered = Boolean(focus || term)
  // Nothing exists yet (not filtered): the empty message carries a link to create a match (page-anatomy section 5).
  const emptyState =
    data && total === 0 ? (
      <EmptyState
        icon={<BrandIcon name="nav/upcoming-matches" size={48} />}
        title={filtered ? 'No matching matches' : showPast ? 'No matches' : 'No upcoming matches'}
        description={
          filtered
            ? 'No matches fit these filters. Clear the quick filter or the search to see more.'
            : 'Nothing to select a team for. Turn on View Entire Season to see earlier fixtures.'
        }
        action={
          filtered ? undefined : (
            <EmptyStateLink onClick={() => navigate(withReturnTo('/manage/fixtures/matches/new', currentOrigin(location), 'Team Selection'))}>Create New Match</EmptyStateLink>
          )
        }
      />
    ) : null
  const fused = view === 'list'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <PageCounters density="compact" items={counters} loading={overview.isPending} />

      {!fused && <ToolbarCard>{bar}</ToolbarCard>}

      {announce.errorAlert}

      {data?.truncated && (
        <Alert severity="info">Only the first matches are shown. Narrow the filters to see the rest.</Alert>
      )}

      {data && fused && (
        <SelectionMatchesTable
          matches={visible}
          onAnnounce={announce.request}
          announcingSideId={announce.announcingSideId}
          onShare={(match, side) => shareSide.share(match.matchId, side.home)}
          sharingMatchId={shareSide.loadingMatchId}
          toolbar={bar}
          empty={emptyState}
          clubId={clubId as string}
          leagueFormatFor={(leagueId) => leagues.find((league) => league.id === leagueId)?.format ?? null}
        />
      )}

      {data && !fused && emptyState}

      {data && !fused && total > 0 && (
        <Box sx={dynamicCardGridSx}>
          {visible.flatMap((match) =>
            match.sides.map((side) => (
              <SelectionMatchCard
                key={`${match.matchId}:${side.teamId}`}
                clubId={clubId as string}
                leagueFormat={leagues.find((league) => league.id === match.leagueId)?.format ?? null}
                match={match}
                side={side}
                onAnnounce={announce.request}
                announcing={side.sideId !== null && side.sideId === announce.announcingSideId}
                onShare={(target, targetSide) => shareSide.share(target.matchId, targetSide.home)}
                sharing={shareSide.loadingMatchId === match.matchId}
              />
            )),
          )}
        </Box>
      )}

      {announce.dialog}
      {shareSide.dialog}
    </Box>
  )
}
