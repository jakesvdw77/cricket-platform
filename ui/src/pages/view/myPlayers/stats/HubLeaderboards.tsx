import { useMemo } from 'react'
import { Alert, Box, Link, Skeleton, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../../components/Button'
import { BrandIcon } from '../../../../components/BrandIcon'
import { StatsCardGrid } from '../../../../components/StatsCards'
import type { CardCtx } from '../../../../components/StatsCards'
import { useMyPlayer } from '../../../../api/myPlayersApi'
import { useMyPlayerResultsFilters } from '../../../../api/meResultsApi'
import type { MyLeaderboardDirection, MyLeaderboardGroup } from '../../../../api/meStatsApi'
import { useMyBoardsFilters, useMyStanding } from '../../../../api/meStatsApi'
import { creamAlpha } from '../../../../brandTokens'
import { HubPageHeader } from '../HubPageHeader'
import { HubPillStrip } from '../HubPillStrip'
import { HubScopePanel, HubScopeSheet, useHubScope } from '../HubScopeControls'
import { HUB } from '../hubStyle'
import { bigSx, cardSx } from '../resultCardStyle'
import { BoardAwards } from './boards/BoardAwards'
import { BoardTable } from './boards/BoardTable'
import { cardsFor } from './statsCardRegistry'
import { groupsFor } from './statsCardGroups'
import { firstNameOf } from './statsFormat'
import { useDefaultBoardsTeam } from './useDefaultBoardsTeam'

// docs/specs/147 section 6 (Player Hub Leaderboards, stats/boards): the same frame as My stats and Team stats. The Season dropdown and Filters
// button are in the header (HubScopeControls, its options are the leaderboard reach from useMyBoardsFilters, saved per player as
// `hubBoards:filters:<playerKey>`). Defaults: the current season and the player's current team (applied once, All Teams stays a choice). The
// "Where <name> stands" flip card is FIRST (from the registry's cardsFor('boards'); this page imports no card), then the tabs Batting, Bowling,
// Fielding (standings TABLES, not cards: spec 103 decision 26) and Awards, in the address as ?tab=, with ?sort= and ?dir= for the table. Rows
// are not links, and nothing here can be shared, copied or downloaded: names are full names and stay on the screen. Read only.
const TEST_PREFIX = 'hub-boards'

type BoardTab = MyLeaderboardGroup | 'awards'
const TABS: { id: BoardTab; label: string }[] = [
  { id: 'batting', label: 'Batting' },
  { id: 'bowling', label: 'Bowling' },
  { id: 'fielding', label: 'Fielding' },
  { id: 'awards', label: 'Awards' },
]

function Skeletons() {
  return (
    <Box sx={{ display: 'grid', gap: 1.75 }} aria-busy="true" data-testid="hub-boards-loading">
      <Skeleton variant="rounded" height={240} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '22px', maxWidth: 560 }} />
      <Skeleton variant="rounded" height={44} sx={{ bgcolor: creamAlpha(0.12) }} />
      <Skeleton variant="rounded" height={240} sx={{ bgcolor: creamAlpha(0.08) }} />
    </Box>
  )
}

export function HubLeaderboards({ playerKey }: { playerKey: string }) {
  const player = useMyPlayer(playerKey).data
  const boardsQuery = useMyBoardsFilters(playerKey)
  const ownFiltersQuery = useMyPlayerResultsFilters(playerKey)
  const filters = boardsQuery.data
  const controls = useHubScope({ playerKey, storageKey: `hubBoards:filters:${playerKey}`, filters, testIdPrefix: TEST_PREFIX, chipRecords: false })
  const { scopeText, clearFilters, scope } = controls
  const [search, setSearch] = useSearchParams()
  const awaitingTeam = useDefaultBoardsTeam(playerKey, controls, ownFiltersQuery.data, filters?.teams.map((team) => team.id))
  const ready = Boolean(filters) && !awaitingTeam

  const requestedTab = search.get('tab')
  const tab: BoardTab = TABS.find((entry) => entry.id === requestedTab)?.id ?? 'batting'
  const requestedDir = search.get('dir')
  const direction: MyLeaderboardDirection | null = requestedDir === 'asc' || requestedDir === 'desc' ? requestedDir : null
  const sort = search.get('sort') || null

  const standingQuery = useMyStanding(playerKey, scope, ready)
  const standing = standingQuery.data
  const firstName = firstNameOf(player?.firstName)

  const ctx = useMemo<CardCtx>(
    () => ({
      firstName,
      scopeLabel: scopeText,
      // Leaderboard rows and the standing card link nowhere; the context asks for both functions.
      resultHref: () => '',
      drillHref: () => '',
    }),
    [firstName, scopeText],
  )

  const writeParams = (change: (params: URLSearchParams) => void) =>
    setSearch(
      (current) => {
        const next = new URLSearchParams(current)
        change(next)
        return next
      },
      { replace: true },
    )
  const selectTab = (next: BoardTab) =>
    writeParams((params) => {
      params.set('tab', next)
      params.delete('sort')
      params.delete('dir')
    })
  const onSort = (code: string | null, dir: MyLeaderboardDirection | null) =>
    writeParams((params) => {
      if (code) params.set('sort', code)
      else params.delete('sort')
      if (dir) params.set('dir', dir)
      else params.delete('dir')
    })
  const showAllSeasons = () => writeParams((params) => params.set('season', 'all'))

  const failed = boardsQuery.isError || ownFiltersQuery.isError
  const header = <HubPageHeader title="Leaderboards" context={failed ? undefined : controls.context} actions={controls.actions} />
  const narrowed = Boolean(controls.leagueId || controls.teamId)

  // No result counted for the scope: the same two messages as the other Stats pages.
  const empty =
    narrowed || controls.seasonId ? (
      <Box data-testid="hub-boards-filtered-empty" sx={{ ...cardSx('neutral'), alignItems: 'center', textAlign: 'center', py: 4, gap: 1.5 }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ ...bigSx, fontSize: 40 }}>No matches for this filter</Typography>
        <Typography sx={{ fontSize: 16, maxWidth: 320, color: HUB.muted }}>{scopeText} has no results shared with the Player Hub.</Typography>
        <Link component="button" type="button" underline="always" onClick={narrowed ? clearFilters : showAllSeasons} sx={{ color: HUB.gold, fontSize: 16, minHeight: 44 }}>
          {narrowed ? 'Clear Filters' : 'Show All Seasons'}
        </Link>
      </Box>
    ) : (
      <Box data-testid="hub-boards-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>No stats yet</Typography>
        <Typography sx={{ fontSize: 15 }}>Leaderboards are worked out from finished matches once the club shares them.</Typography>
      </Box>
    )

  let body
  if (failed) {
    body = (
      <Alert
        severity="error"
        action={
          <Button
            variant="secondary"
            size="compact"
            onClick={() => {
              void boardsQuery.refetch()
              void ownFiltersQuery.refetch()
            }}
          >
            Retry
          </Button>
        }
      >
        We could not load the leaderboards. Please try again.
      </Alert>
    )
  } else if (!ready) {
    body = <Skeletons />
  } else {
    body = (
      <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
        {standing && standing.resultsCounted > 0 && (
          <Box data-testid="hub-boards-standing" sx={{ minWidth: 0, opacity: standingQuery.isPlaceholderData ? 0.55 : 1 }}>
            <StatsCardGrid
              payload={standing}
              ctx={ctx}
              cards={cardsFor('boards')}
              groups={groupsFor('boards')}
              basis={{ counted: standing.resultsCounted, total: standing.resultsCounted }}
              scopeKey={`${scope.seasonId}|${scope.leagueId}|${scope.teamId}`}
              testId="hub-boards-standing-grid"
            />
          </Box>
        )}
        {standingQuery.isLoading && <Skeleton variant="rounded" height={240} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '22px', maxWidth: 560 }} />}
        <HubPillStrip compact label="Leaderboard" items={TABS} selectedId={tab} onSelect={(item) => selectTab(item.id as BoardTab)} />
        {tab === 'awards' ? (
          <BoardAwards playerKey={playerKey} scope={scope} empty={empty} enabled={ready} />
        ) : (
          <BoardTable key={tab} playerKey={playerKey} group={tab} scope={scope} firstName={firstName} sort={sort} direction={direction} onSort={onSort} empty={empty} enabled={ready} />
        )}
      </Box>
    )
  }

  return (
    <Box data-testid="hub-boards" sx={{ display: 'grid', gridTemplateColumns: controls.panelOpen ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)', gap: controls.panelOpen ? 2.5 : 0, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 1, minWidth: 0 }}>
        {header}
        {body}
      </Box>
      <HubScopePanel controls={controls} />
      <HubScopeSheet controls={controls} matchCount={standing?.resultsCounted} noun="result" nounPlural="results" />
    </Box>
  )
}
