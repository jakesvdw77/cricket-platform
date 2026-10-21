import { useMemo, useState } from 'react'
import { Link as RouterLink, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { Box, Button as MuiButton, Chip, Skeleton, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined'
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { badgeSx } from '../../../components/RecordCard'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { useTeamStats, useTeamStatsFilterOptions } from '../../../api/teamStatsApi'
import type { TeamStatsCompetition } from '../../../api/teamStatsApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { useStatsFilterLookups } from '../../../hooks/useStatsFilterLookups'
import { CardGrid, NotCapturedPanel, StatTile, StatTileStrip } from '../playerStats/statsParts'
import { countText, teamPageBasisLines, teamStatsLink, winPercentText } from '../leaderboards/teamStatsFormat'
import { TeamFormStrip } from './TeamFormStrip'
import { BattingCard, BowlingCard, ExtrasCard, HighlightsCard, NetRunRateCard, RecordCard } from './TeamStatsCards'

const COMPETITION_OPTIONS = [
  { value: 'LEAGUE', label: 'League' },
  { value: 'FRIENDLY', label: 'Friendlies' },
]

const DEFAULT_BACK = { to: '/manage/leaderboards?tab=teams', label: 'Teams' }

// ?competition= from a link: only the two known values count, anything else means no filter.
function parseCompetition(value: string | null): TeamStatsCompetition | null {
  return value === 'LEAGUE' || value === 'FRIENDLY' ? value : null
}

// docs/specs/115: a page that links here may pass router state { backTo, backLabel }; only an in-app /manage/ path is followed.
function backTarget(state: unknown): { to: string; label: string } {
  const candidate = state as { backTo?: unknown; backLabel?: unknown } | null | undefined
  if (candidate && typeof candidate.backTo === 'string' && candidate.backTo.startsWith('/manage/')) {
    const label = typeof candidate.backLabel === 'string' && candidate.backLabel.trim() ? candidate.backLabel.trim() : 'previous page'
    return { to: candidate.backTo, label }
  }
  return DEFAULT_BACK
}

// docs/specs/116-team-stats.md: one team's statistics (/manage/teams/:teamId/stats). Back (to the Teams table or the Team detail
// page it came from), the team name and status, a compact FilterBar (Season, League, Competition; Season and League are saved per
// club, Competition is per visit), the basis line, four headline tiles, the form strip, the six cards and the Not captured yet
// panel. All filters are backend parameters; the page only displays what the server computed.
export default function TeamStatsPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { teamId } = useParams<{ teamId?: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const back = backTarget(location.state)

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

  // There is no per-team options read, so the bar offers the club-wide values that have counted team results
  // (GET /team-stats/filter-options); a team with nothing under one of them simply shows the empty state.
  const optionsQuery = useTeamStatsFilterOptions(clubId)
  const options = optionsQuery.data
  const available = useMemo(
    () => (options ? { seasonIds: options.seasonIds, leagueIds: options.leagueIds, teamIds: [], sectionIds: options.sectionIds } : undefined),
    [options],
  )
  const lookups = useStatsFilterLookups(clubId, available)
  const { seasons: seasonOptions, leagues: leagueOptions } = lookups
  const competitionOptions = COMPETITION_OPTIONS.filter((option) => options?.competitions.includes(option.value))

  // A saved choice that is not offered falls back to none (All seasons / All leagues).
  const wantedSeason = seasonOverride !== undefined ? seasonOverride : saved.seasonId
  const wantedLeague = leagueOverride !== undefined ? leagueOverride : saved.leagueId
  const seasonId = wantedSeason && (!available || !lookups.allSeasons || seasonOptions.some((option) => option.id === wantedSeason)) ? wantedSeason : null
  const leagueId = wantedLeague && (!available || !lookups.allLeagues || leagueOptions.some((option) => option.id === wantedLeague)) ? wantedLeague : null

  const filters = { seasonId, leagueId, competition }
  const hasFilters = Boolean(seasonId || leagueId || competition)
  const statsQuery = useTeamStats(clubId, teamId, filters, { keepPrevious: true })
  const stats = statsQuery.data
  useDocumentTitle(stats ? `${stats.teamName} · Statistics` : 'Team statistics')

  // Where a result's Back returns: this page with the filters in force (an empty Season or League means All, so it is not
  // replaced by the saved choice on return).
  const pageUrl = teamId ? teamStatsLink(teamId, filters, competition) : ''

  const clearFilters = () => {
    updateSaved({ seasonId: null, leagueId: null })
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
        action={
          <MuiButton variant="outlined" onClick={() => statsQuery.refetch()} sx={{ minHeight: 44 }}>
            Try again
          </MuiButton>
        }
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
        action={
          <MuiButton variant="outlined" onClick={clearFilters} sx={{ minHeight: 44 }}>
            Clear filters
          </MuiButton>
        }
      />
    ) : (
      <EmptyState
        title="No published results yet"
        description="Team statistics appear here once a published result includes this team."
        action={
          <MuiButton component={RouterLink} to="/manage/results" variant="outlined" sx={{ minHeight: 44 }}>
            Go to Results
          </MuiButton>
        }
      />
    )
  } else {
    body = (
      <>
        <Box data-testid="stats-basis">
          {teamPageBasisLines(stats.basis).map((line) => (
            <Typography key={line} component="span" variant="caption" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.4, mr: 0.75 }}>
              {line}
            </Typography>
          ))}
        </Box>
        <StatTileStrip>
          <StatTile testId="tile-played" icon={<SportsCricketOutlinedIcon />} label="Played" value={countText(stats.record.played)} />
          <StatTile testId="tile-won" icon={<EmojiEventsOutlinedIcon />} label="Won" value={countText(stats.record.won)} />
          <StatTile testId="tile-lost" icon={<TrendingDownOutlinedIcon />} label="Lost" value={countText(stats.record.lost)} />
          <StatTile testId="tile-win-percent" icon={<PercentOutlinedIcon />} label="Win %" value={winPercentText(stats.record.winPercent)} />
        </StatTileStrip>
        <TeamFormStrip items={stats.form} backTo={pageUrl} />
        <CardGrid>
          <RecordCard stats={stats} />
          <BattingCard stats={stats} backTo={pageUrl} />
          <HighlightsCard stats={stats} backTo={pageUrl} />
          <BowlingCard stats={stats} />
          <ExtrasCard stats={stats} />
          <NetRunRateCard stats={stats} />
        </CardGrid>
        <NotCapturedPanel items={stats.notCaptured} />
      </>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeaderBand>
        <MuiButton
          component={RouterLink}
          to={back.to}
          variant="text"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ mb: 1, ml: -1, minHeight: 44, color: 'text.secondary' }}
        >
          Back to {back.label}
        </MuiButton>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            {stats ? stats.teamName : 'Team statistics'}
          </Typography>
          {stats && <Chip size="small" label={stats.active ? 'Active' : 'Inactive'} sx={badgeSx(stats.active ? 'positive' : 'muted')} data-testid="team-status-badge" />}
        </Stack>
      </PageHeaderBand>

      {!neverPlayed && (
        <FilterBar
          density="compact"
          seasons={seasonOptions.length > 0 ? seasonOptions : undefined}
          leagues={leagueOptions.length > 0 ? leagueOptions : undefined}
          seasonId={seasonId}
          leagueId={leagueId}
          onSeasonChange={(value) => {
            setSeasonOverride(undefined)
            updateSaved({ seasonId: value })
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
                    allLabel: 'All competitions',
                    options: competitionOptions,
                    value: competition ?? '',
                    onChange: (value) => setCompetition((value || null) as TeamStatsCompetition | null),
                  },
                ]
              : []
          }
          onClearAll={clearFilters}
        />
      )}

      {body}
    </Box>
  )
}
