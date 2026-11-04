import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useBackLink } from '../../../hooks/useReturnTo'
import { Box, Chip, Skeleton, Stack } from '@mui/material'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { PageCounters } from '../../../components/PageCounters'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { badgeSx } from '../../../components/RecordCard'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { useTeamDashboard } from '../../../api/teamDashboardApi'
import { useTeamStats, useTeamStatsFilterOptions } from '../../../api/teamStatsApi'
import type { TeamStatsCompetition } from '../../../api/teamStatsApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { useStatsFilterLookups } from '../../../hooks/useStatsFilterLookups'
import { backTarget } from '../../../utils/backTarget'
import { pickDefaultSeasonId } from '../../../utils/defaultSeason'
import { parseCompetition } from '../../../utils/statsCompetition'
import { CardGrid, NotCapturedPanel } from '../playerStats/statsParts'
import { countText, teamPageBasisLines, teamStatsLink, winPercentText } from '../leaderboards/teamStatsFormat'
import { TeamFormStrip } from './TeamFormStrip'
import { TeamDashboardBlock } from './dashboard/TeamDashboardBlock'
import { loadTeamDashboardCharts } from './dashboard/teamDashboardChunk'
import { BattingCard, BowlingCard, ExtrasCard, HighlightsCard, NetRunRateCard, RecordCard } from './TeamStatsCards'
import { Button } from '../../../components/Button'

const COMPETITION_OPTIONS = [
  { value: 'LEAGUE', label: 'League' },
  { value: 'FRIENDLY', label: 'Friendlies' },
]

// Stored in place of a season id when All seasons was chosen on purpose (null means "never chosen": the current season).
const ALL_SEASONS = 'all'

const DEFAULT_BACK = { to: '/manage/leaderboards?tab=teams', label: 'Teams' }

// docs/specs/116-team-stats.md: one team's statistics (/manage/teams/:teamId/stats). Back (to the Teams table or the Team detail
// page it came from), the team name and status, a compact FilterBar (Season, League, Competition; Season and League are saved per
// club, Competition is per visit), the basis line, four headline tiles, the form strip, the Dashboard block (spec 117), the six cards and the
// Not captured yet panel. All filters are backend parameters; the page only displays what the server computed.
export default function TeamStatsPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { teamId } = useParams<{ teamId?: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const legacyBack = backTarget(location.state, DEFAULT_BACK)
  // docs/specs/142: a returnTo in the address wins (Back restores the list's view); the older router state is the fallback.
  const back = useBackLink(legacyBack.to, `Back to ${legacyBack.label}`)

  const [saved, updateSaved] = usePersistedListFilters<{ seasonId: string | null; leagueId: string | null }>(
    `teamStats:filters:${clubId}`,
    { seasonId: null, leagueId: null },
  )
  // The Teams table row links here carrying its Season, League and Competition (an empty value means none). Read once on load;
  // after that the bar's own choices rule. Season and League start from the link WITHOUT overwriting the saved choice.
  const [linked] = useState(() => ({
    seasonId: searchParams.has('seasonId') ? searchParams.get('seasonId') || null : undefined,
    leagueId: searchParams.has('leagueId') ? searchParams.get('leagueId') || null : undefined,
    competition: parseCompetition(searchParams.get('competition')),
  }))
  const [seasonOverride, setSeasonOverride] = useState<string | null | undefined>(linked.seasonId)
  const [leagueOverride, setLeagueOverride] = useState<string | null | undefined>(linked.leagueId)
  const [competition, setCompetition] = useState<TeamStatsCompetition | null>(linked.competition)

  // The bar offers only the values this team has counted results under (GET /team-stats/filter-options?teamId=).
  const optionsQuery = useTeamStatsFilterOptions(clubId, true, teamId)
  const options = optionsQuery.data
  const available = useMemo(
    () => (options ? { seasonIds: options.seasonIds, leagueIds: options.leagueIds, teamIds: [], sectionIds: options.sectionIds } : undefined),
    [options],
  )
  const lookups = useStatsFilterLookups(clubId, available, optionsQuery.isError)
  const { seasons: seasonOptions, leagues: leagueOptions } = lookups
  const competitionOptions = COMPETITION_OPTIONS.filter((option) => options?.competitions.includes(option.value))
  const defaultSeasonId = useMemo(() => pickDefaultSeasonId(lookups.allSeasons ?? []) ?? null, [lookups.allSeasons])

  // Season, like the Teams table: a link's value (empty = All seasons), else All seasons if that was chosen, else the saved season
  // if it is still offered, else the current season if this team has data in it, else All. League: the link, else the saved one
  // if offered, else All.
  const offered = (list: { id: string }[], id: string | null | undefined) => (id && list.some((option) => option.id === id) ? id : null)
  const seasonId =
    seasonOverride !== undefined
      ? !seasonOverride || !available || offered(seasonOptions, seasonOverride)
        ? seasonOverride
        : null
      : saved.seasonId === ALL_SEASONS
        ? null
        : (offered(seasonOptions, saved.seasonId) ?? offered(seasonOptions, defaultSeasonId))
  const wantedLeague = leagueOverride !== undefined ? leagueOverride : saved.leagueId
  const leagueId = wantedLeague && (!available || !lookups.allLeagues || leagueOptions.some((option) => option.id === wantedLeague)) ? wantedLeague : null
  // The page waits for the options before asking for figures unless a link fixed the Season, so the default is chosen once.
  const ready = seasonOverride !== undefined || (!optionsQuery.isLoading && !lookups.loading)

  const filters = { seasonId, leagueId, competition }
  const hasFilters = Boolean(seasonId || leagueId || competition)
  const statsQuery = useTeamStats(clubId, teamId, filters, { keepPrevious: true, enabled: ready })
  const stats = statsQuery.data
  // docs/specs/117-stats-dashboard.md: the Dashboard block is expanded by default (per visit). Its one series read goes out in parallel with
  // the stats read, with the page's own filters, once the page is ready and only while the block is shown; the chart chunk with it.
  const [dashboardShown, setDashboardShown] = useState(true)
  const dashboardQuery = useTeamDashboard(clubId, teamId, filters, ready && dashboardShown)
  useEffect(() => {
    if (ready && dashboardShown) void loadTeamDashboardCharts()
  }, [ready, dashboardShown])
  useDocumentTitle(stats ? `${stats.teamName} · Statistics` : 'Team statistics')

  // Where a result's Back returns: this page with the filters in force (an empty Season or League means All, so it is not
  // replaced by the saved choice on return).
  const pageUrl = teamId ? teamStatsLink(teamId, filters, competition) : ''

  const clearFilters = () => {
    updateSaved({ seasonId: ALL_SEASONS, leagueId: null })
    setSeasonOverride(undefined)
    setLeagueOverride(undefined)
    setCompetition(null)
  }

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const neverPlayed = Boolean(stats && stats.basis.resultsCounted === 0 && !hasFilters)
  const noResults = Boolean(stats && stats.basis.resultsCounted === 0)

  let body
  if (statsQuery.isError) {
    body = (
      <EmptyState
        title="Couldn't load the statistics"
        description="Something went wrong loading this team's statistics."
        action={<Button size="compact" variant="secondary" onClick={() => statsQuery.refetch()}>Try Again</Button>}
      />
    )
  } else if (!stats) {
    body = (
      <Stack spacing={1.5} aria-busy="true" aria-label="Loading statistics">
        <Skeleton variant="rounded" height={64} />
        <Skeleton variant="rounded" height={160} />
      </Stack>
    )
  } else if (noResults) {
    body = hasFilters ? (
      <EmptyState
        title="No published results match these filters"
        description="Try a different season, league or competition."
        action={<EmptyStateLink onClick={clearFilters}>Clear Filters</EmptyStateLink>}
      />
    ) : (
      <EmptyState
        title="No published results yet"
        description="Team statistics appear here once a published result includes this team."
        action={<EmptyStateLink onClick={() => navigate('/manage/results')}>Open Results</EmptyStateLink>}
      />
    )
  } else {
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TeamFormStrip items={stats.form} backTo={pageUrl} />
        <TeamDashboardBlock shown={dashboardShown} onToggle={() => setDashboardShown((value) => !value)} dashboard={dashboardQuery} backTo={pageUrl} />
        <CardGrid>
          <RecordCard stats={stats} />
          <BattingCard stats={stats} backTo={pageUrl} />
          <HighlightsCard stats={stats} backTo={pageUrl} />
          <BowlingCard stats={stats} />
          <ExtrasCard stats={stats} />
          <NetRunRateCard stats={stats} />
        </CardGrid>
        <NotCapturedPanel items={stats.notCaptured} />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 }, minWidth: 0 }}>
      <ManageScreenHeader
        title={stats ? stats.teamName : 'Team statistics'}
        backTo={back.to}
        backLabel={back.label}
        titleAdornment={stats ? <Chip size="small" label={stats.active ? 'Active' : 'Inactive'} sx={badgeSx(stats.active ? 'positive' : 'muted')} data-testid="team-status-badge" /> : undefined}
      />

      {/* docs/specs/142 and page-anatomy section 0: the figures come first, directly under the title; the basis sentences are the first card's info icon. */}
      {stats && !noResults && (
        <PageCounters
          density="compact"
          items={[
            { id: 'played', testId: 'tile-played', label: 'Played', value: countText(stats.record.played), info: teamPageBasisLines(stats.basis).join(' ') },
            { id: 'won', testId: 'tile-won', label: 'Won', value: countText(stats.record.won) },
            { id: 'lost', testId: 'tile-lost', label: 'Lost', value: countText(stats.record.lost) },
            { id: 'win-percent', testId: 'tile-win-percent', label: 'Win %', value: winPercentText(stats.record.winPercent) },
          ]}
        />
      )}

      {!neverPlayed && (
        <ToolbarCard>
        <FilterBar
          bare
          inCard
          density="compact"
          seasons={seasonOptions.length > 0 ? seasonOptions : undefined}
          leagues={leagueOptions.length > 0 ? leagueOptions : undefined}
          seasonId={seasonId}
          leagueId={leagueId}
          onSeasonChange={(value) => {
            setSeasonOverride(undefined)
            updateSaved({ seasonId: value ?? ALL_SEASONS })
          }}
          onLeagueChange={(value) => {
            setLeagueOverride(undefined)
            updateSaved({ leagueId: value })
          }}
          extraSelects={
            competitionOptions.length > 0
              ? [
                  {
                    key: 'competition',
                    label: 'Competition',
                    allLabel: 'All Competitions',
                    options: competitionOptions,
                    value: competition ?? '',
                    onChange: (value) => setCompetition((value || null) as TeamStatsCompetition | null),
                  },
                ]
              : []
          }
          onClearAll={clearFilters}
        />
        </ToolbarCard>
      )}

      {body}
    </Box>
  )
}
