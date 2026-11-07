import { useMemo } from 'react'
import { Alert, Box, Link, Skeleton, Typography } from '@mui/material'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Button } from '../../../../components/Button'
import { BrandIcon } from '../../../../components/BrandIcon'
import { StatsCardGrid } from '../../../../components/StatsCards'
import type { CardCtx, DrillTarget, GroupPickerProps } from '../../../../components/StatsCards'
import { useMyPlayer } from '../../../../api/myPlayersApi'
import { useMyPlayerResultsFilters } from '../../../../api/meResultsApi'
import { useMyStats } from '../../../../api/meStatsApi'
import { creamAlpha } from '../../../../brandTokens'
import { HubPageHeader } from '../HubPageHeader'
import { HubPillStrip } from '../HubPillStrip'
import { HubScopePanel, HubScopeSheet, useHubScope } from '../HubScopeControls'
import { HUB } from '../hubStyle'
import { bigSx, cardSx } from '../resultCardStyle'
import { cardsFor } from './statsCardRegistry'
import { groupsFor } from './statsCardGroups'
import { firstNameOf } from './statsFormat'
import { statsDrillPath, statsResultPath, statsScopeQuery } from './statsRoutes'

// docs/specs/147 (Player Hub My stats, stats/mine): the page frame, in the Results pattern. The title and the Season dropdown and Filters
// button are in the header (HubScopeControls); the cards are laid out by StatsCardGrid from the registry's cardsFor (this page imports no
// individual card) and read ONE payload (useMyStats). The scope lives in the URL with the per-player saved value as the fallback (defaults:
// the current season, all of the player's teams). Result links and drill links carry the stats origin and the scope, so the footer Back
// returns here with the same scope. Read only; the footer owns Back.
const TEST_PREFIX = 'hub-stats'

const gridCols = { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(310px, 1fr))' } as const

function Skeletons() {
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: gridCols }} aria-busy="true" data-testid="hub-stats-loading">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} variant="rounded" height={240} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '22px' }} />
      ))}
    </Box>
  )
}

export function HubMyStats({ playerKey }: { playerKey: string }) {
  const player = useMyPlayer(playerKey).data
  const filtersQuery = useMyPlayerResultsFilters(playerKey)
  const filters = filtersQuery.data
  const controls = useHubScope({ playerKey, storageKey: `hubStats:filters:${playerKey}`, filters, testIdPrefix: TEST_PREFIX })
  const { scope, narrowed, scopeText, clearFilters } = controls
  const [, setSearch] = useSearchParams()

  const statsQuery = useMyStats(playerKey, scope, Boolean(filters))
  const stats = statsQuery.data
  const firstName = firstNameOf(stats?.playerFirstName ?? player?.firstName)
  const scopeQuery = statsScopeQuery(scope)

  // The card context: links keep the stats origin and the scope in the address, so Back returns to this page with the same scope.
  const ctx = useMemo<CardCtx>(
    () => ({
      firstName,
      scopeLabel: scopeText,
      resultHref: (matchId: string) => statsResultPath(playerKey, matchId, scopeQuery),
      drillHref: (target: DrillTarget) => statsDrillPath(playerKey, target, scopeQuery),
    }),
    [firstName, scopeText, playerKey, scopeQuery],
  )

  const failed = filtersQuery.isError || statsQuery.isError
  const header = <HubPageHeader title="Player Stats" context={failed ? undefined : controls.context} actions={controls.actions} />

  const showAllSeasons = () =>
    setSearch(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('season', 'all')
        return next
      },
      { replace: true },
    )

  const renderGroupPicker = ({ label, items, selectedId, onSelect }: GroupPickerProps) => (
    <HubPillStrip compact label={label} items={items} selectedId={selectedId} onSelect={(item) => onSelect(item.id)} />
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
              void filtersQuery.refetch()
              void statsQuery.refetch()
            }}
          >
            Retry
          </Button>
        }
      >
        We could not load the stats. Please try again.
      </Alert>
    )
  } else if (!filters || !stats) {
    body = <Skeletons />
  } else if (stats.basis.resultsCounted === 0 && (narrowed || controls.seasonId)) {
    body = (
      <Box data-testid="hub-stats-filtered-empty" sx={{ ...cardSx('neutral'), alignItems: 'center', textAlign: 'center', py: 4, gap: 1.5 }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ ...bigSx, fontSize: 40 }}>No matches for this filter</Typography>
        <Typography sx={{ fontSize: 16, maxWidth: 320, color: HUB.muted }}>{scopeText} has no results shared with the Player Hub.</Typography>
        <Link component="button" type="button" underline="always" onClick={narrowed ? clearFilters : showAllSeasons} sx={{ color: HUB.gold, fontSize: 16, minHeight: 44 }}>
          {narrowed ? 'Clear Filters' : 'Show All Seasons'}
        </Link>
      </Box>
    )
  } else if (stats.basis.resultsCounted === 0) {
    body = (
      <Box data-testid="hub-stats-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>No stats yet</Typography>
        <Typography sx={{ fontSize: 15 }}>
          Stats are worked out from finished matches once the club shares them. See the{' '}
          <Link component={RouterLink} to={`/account/players/${playerKey}/results`} underline="always" sx={{ color: HUB.gold }}>
            Results
          </Link>
          .
        </Typography>
      </Box>
    )
  } else {
    body = (
      <Box sx={{ display: 'grid', gap: 1, minWidth: 0, opacity: statsQuery.isPlaceholderData ? 0.55 : 1 }}>
        <StatsCardGrid
          payload={stats}
          ctx={ctx}
          cards={cardsFor('mine')}
          groups={groupsFor('mine')}
          basis={{ counted: stats.basis.resultsCounted, total: stats.basis.resultsCounted }}
          scopeKey={scopeQuery}
          renderGroupPicker={renderGroupPicker}
          testId="hub-stats-grid"
        />
      </Box>
    )
  }

  return (
    <Box data-testid="hub-stats" sx={{ display: 'grid', gridTemplateColumns: controls.panelOpen ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)', gap: controls.panelOpen ? 2.5 : 0, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 1, minWidth: 0 }}>
        {header}
        {body}
      </Box>
      <HubScopePanel controls={controls} />
      <HubScopeSheet controls={controls} matchCount={stats?.basis.resultsCounted} noun="result" nounPlural="results" />
    </Box>
  )
}
