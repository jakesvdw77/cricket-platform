import { useEffect, useMemo } from 'react'
import { Alert, Box, Link, Skeleton, Typography } from '@mui/material'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Button } from '../../../../components/Button'
import { BrandIcon } from '../../../../components/BrandIcon'
import { StatsCardGrid } from '../../../../components/StatsCards'
import type { CardCtx, DrillTarget, GroupPickerProps } from '../../../../components/StatsCards'
import { useMyPlayer } from '../../../../api/myPlayersApi'
import { useMyPlayerResults, useMyPlayerResultsFilters } from '../../../../api/meResultsApi'
import type { MyResultFilters, MyResultScope } from '../../../../api/meResultsApi'
import { useMyTeamStats } from '../../../../api/meStatsApi'
import { creamAlpha } from '../../../../brandTokens'
import { HubPageHeader } from '../HubPageHeader'
import { HubPillStrip } from '../HubPillStrip'
import { HubScopePanel, HubScopeSheet, useHubScope } from '../HubScopeControls'
import { HUB } from '../hubStyle'
import { bigSx, cardSx } from '../resultCardStyle'
import { cardsFor } from './statsCardRegistry'
import { groupsFor } from './statsCardGroups'
import { firstNameOf } from './statsFormat'
import { statsDrillPath, statsScopeQuery, teamStatsResultPath } from './statsRoutes'

// docs/specs/147 (Player Hub Team stats, stats/teams): the same frame as My stats. The scope controls are shared (HubScopeControls, the saved
// scope is the same `hubStats:filters:<playerKey>` as My stats); the cards come from the registry's cardsFor('team') and read ONE payload
// (useMyTeamStats), which needs exactly one team. Defaults: the current season and the player's current team (the team of the latest flagged
// result in the season, else the first team that has results). A player with several teams sees the Team chips (the chosen team is written
// to the address); a one-team player sees the quiet line and the team is only implied. Result links carry the team-stats origin and the
// scope, so the footer Back returns here. Read only; the footer owns Back.
const TEST_PREFIX = 'hub-teamstats'

const gridCols = { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(310px, 1fr))' } as const

function Skeletons() {
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: gridCols }} aria-busy="true" data-testid="hub-teamstats-loading">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} variant="rounded" height={240} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '22px' }} />
      ))}
    </Box>
  )
}

// The teams of the player that have results in the chosen season (and league), from the shared results/filters read.
function teamsIn(filters: MyResultFilters, scope: MyResultScope): { id: string; name: string }[] {
  const combos = filters.combos.filter(
    (combo) =>
      (!scope.seasonId || combo.seasonId === scope.seasonId) &&
      (!scope.leagueId || combo.leagueId === scope.leagueId) &&
      (scope.competition !== 'FRIENDLY' || combo.leagueId === null),
  )
  return filters.teams.filter((team) => combos.some((combo) => combo.teamId === team.id))
}

export function HubTeamStats({ playerKey }: { playerKey: string }) {
  const player = useMyPlayer(playerKey).data
  const filtersQuery = useMyPlayerResultsFilters(playerKey)
  const filters = filtersQuery.data
  const controls = useHubScope({ playerKey, storageKey: `hubStats:filters:${playerKey}`, filters, alwaysShowFilters: true, testIdPrefix: TEST_PREFIX })
  const { scopeText, clearFilters } = controls
  const leagueNarrowed = Boolean(controls.leagueId || controls.friendly)
  const [, setSearch] = useSearchParams()

  // The team: the chosen one, else the player's current team. Several teams: ask the newest flagged result of the season for its team.
  const options = filters ? teamsIn(filters, controls.scope) : []
  const needDefault = Boolean(filters) && !controls.teamId && options.length > 0
  const latest = useMyPlayerResults(playerKey, { seasonId: controls.scope.seasonId, leagueId: controls.scope.leagueId, competition: controls.scope.competition }, needDefault && options.length > 1)
  let defaultTeamId = ''
  if (needDefault) {
    if (options.length === 1) defaultTeamId = options[0].id
    else if (!latest.isLoading) {
      const newest = latest.data?.pages[0]?.rows[0]
      defaultTeamId = newest?.ourTeams.map((team) => team.teamId).find((id) => Boolean(id) && options.some((option) => option.id === id)) ?? options[0].id
    }
  }
  const teamId = controls.teamId || defaultTeamId
  const awaitingTeam = needDefault && !teamId
  const noTeam = Boolean(filters) && options.length === 0 && !controls.teamId
  const scope = useMemo<MyResultScope>(() => ({ ...controls.scope, teamId: teamId || null }), [controls.scope, teamId])

  // Several teams: write the default team to the address so the Team chips show it and a link out and back keeps it.
  useEffect(() => {
    if (!defaultTeamId || options.length < 2) return
    setSearch(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('team', defaultTeamId)
        return next
      },
      { replace: true },
    )
  }, [defaultTeamId, options.length, setSearch])

  const statsQuery = useMyTeamStats(playerKey, scope, Boolean(filters) && Boolean(teamId))
  const stats = statsQuery.data
  const firstName = firstNameOf(player?.firstName)
  const scopeQuery = statsScopeQuery(scope)
  // The cards always name the team: when it is only implied (the player's current team, not in the address) the shared scope text has no team in
  // it, so the team is put after the season ("2025/26 · U14 A · Premier League") and a screenshot is never about an unnamed team.
  const impliedTeam = controls.teamId ? undefined : stats?.teamName
  const cardScope = useMemo(() => {
    if (!impliedTeam) return scopeText
    const [season, ...rest] = scopeText.split(' · ')
    return [season, impliedTeam, ...rest].join(' · ')
  }, [scopeText, impliedTeam])

  // The card context: links keep the team-stats origin and the scope in the address, so Back returns to this page with the same scope.
  const ctx = useMemo<CardCtx>(
    () => ({
      firstName,
      teamName: stats?.teamName,
      scopeLabel: cardScope,
      resultHref: (matchId: string) => teamStatsResultPath(playerKey, matchId, scopeQuery),
      drillHref: (target: DrillTarget) => statsDrillPath(playerKey, target, scopeQuery),
    }),
    [firstName, stats?.teamName, cardScope, playerKey, scopeQuery],
  )

  const failed = filtersQuery.isError || statsQuery.isError
  const header = <HubPageHeader title="Team Stats" context={failed ? undefined : controls.context} actions={controls.actions} />

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
  } else if (noTeam) {
    body = (
      <Box data-testid="hub-teamstats-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>No stats yet</Typography>
        <Typography sx={{ fontSize: 15 }}>
          Team stats are worked out from finished matches once the club shares them. See the{' '}
          <Link component={RouterLink} to={`/account/players/${playerKey}/results`} underline="always" sx={{ color: HUB.gold }}>
            Results
          </Link>
          .
        </Typography>
      </Box>
    )
  } else if (!filters || awaitingTeam || !stats) {
    body = <Skeletons />
  } else if (stats.basis.resultsCounted === 0 && (leagueNarrowed || controls.seasonId)) {
    body = (
      <Box data-testid="hub-teamstats-filtered-empty" sx={{ ...cardSx('neutral'), alignItems: 'center', textAlign: 'center', py: 4, gap: 1.5 }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ ...bigSx, fontSize: 40 }}>No matches for this filter</Typography>
        <Typography sx={{ fontSize: 16, maxWidth: 320, color: HUB.muted }}>{scopeText} has no results shared with the Player Hub.</Typography>
        <Link component="button" type="button" underline="always" onClick={leagueNarrowed ? clearFilters : showAllSeasons} sx={{ color: HUB.gold, fontSize: 16, minHeight: 44 }}>
          {leagueNarrowed ? 'Clear Filters' : 'Show All Seasons'}
        </Link>
      </Box>
    )
  } else if (stats.basis.resultsCounted === 0) {
    body = (
      <Box data-testid="hub-teamstats-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
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
          cards={cardsFor('team')}
          groups={groupsFor('team')}
          basis={{ counted: stats.basis.resultsCounted, total: stats.basis.resultsCounted }}
          scopeKey={scopeQuery}
          renderGroupPicker={renderGroupPicker}
          testId="hub-teamstats-grid"
        />
      </Box>
    )
  }

  return (
    <Box data-testid="hub-teamstats" sx={{ display: 'grid', gridTemplateColumns: controls.panelOpen ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)', gap: controls.panelOpen ? 2.5 : 0, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 1, minWidth: 0 }}>
        {header}
        {body}
      </Box>
      <HubScopePanel controls={controls} />
      <HubScopeSheet controls={controls} matchCount={stats?.basis.resultsCounted} noun="result" nounPlural="results" />
    </Box>
  )
}
