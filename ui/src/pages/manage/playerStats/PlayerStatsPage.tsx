import { useMemo, useState } from 'react'
import { Link as RouterLink, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Button as MuiButton, Chip, Skeleton, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { badgeSx } from '../../../components/RecordCard'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { usePlayerStats, usePlayerStatsFilterOptions } from '../../../api/playerStatsApi'
import type { PlayerStats, StatsCompetition } from '../../../api/playerStatsApi'
import { listPlayers } from '../../../api/playerApi'
import { listSeasons } from '../../../api/seasonApi'
import { listLeagues } from '../../../api/leagueApi'
import { listSections } from '../../../api/sectionApi'
import { listTeamsForClub } from '../../../api/teamApi'
import { useAvailabilitySeason } from '../../../hooks/useAvailabilitySeason'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { playerStatusBadge, playerStatusOf } from '../../../utils/playerStatus'
import { fullName } from '../PlayerList'
import { PlayerStatsTabs } from './PlayerStatsTabs'
import { resolvePlayerStatsTab } from './playerStatsTabConfig'
import { BattingTab } from './BattingTab'
import { BowlingTab } from './BowlingTab'
import { FieldingTab } from './FieldingTab'
import { AwardsTab } from './AwardsTab'
import { resultsPhrase } from './statsFormat'

const COMPETITION_OPTIONS = [
  { value: 'LEAGUE', label: 'League' },
  { value: 'FRIENDLY', label: 'Friendlies' },
]

function basisLine(stats: PlayerStats, tab: ReturnType<typeof resolvePlayerStatsTab>): string {
  const { matchesCounted, resultsWithBattingCard, resultsWithBowlingCard } = stats.basis
  const lead = `Based on ${resultsPhrase(matchesCounted)} with this player on the team list`
  if (tab === 'batting') return `${lead}: ${resultsWithBattingCard} with a batting card.`
  if (tab === 'bowling') return `${lead}: ${resultsWithBowlingCard} with a bowling card.`
  return `${lead}.`
}

// docs/specs/103-player-stats.md: the full breakdown of one player's published results (/manage/players/:playerId/stats).
// Back, name and status, a Batting | Bowling | Fielding | Awards & record strip bound to ?tab=, a compact FilterBar (Season, League, Section,
// Team and Competition; Season and League are saved per club, the rest are per visit), a basis line, and the active tab.
// All filters are backend parameters; the page only displays what the server computed.
export default function PlayerStatsPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { playerId } = useParams<{ playerId?: string }>()
  const [searchParams] = useSearchParams()
  const tab = resolvePlayerStatsTab(searchParams.get('tab'))

  const [saved, updateSaved] = usePersistedListFilters<{ seasonId: string | null; leagueId: string | null }>(
    `playerStats:filters:${clubId}`,
    { seasonId: null, leagueId: null },
  )
  const [teamId, setTeamId] = useState<string | null>(null)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [competition, setCompetition] = useState<StatsCompetition | null>(null)

  // The player's name and status come from the roster read the Player page uses (same cache entry).
  const { seasonId: defaultSeasonId, seasonsLoading } = useAvailabilitySeason(clubId)
  const playerQuery = useQuery({
    queryKey: ['managed-club', clubId, 'players', 'detail', defaultSeasonId],
    queryFn: () => listPlayers(clubId as string, { seasonId: defaultSeasonId }),
    enabled: Boolean(clubId) && !seasonsLoading,
    select: (players) => players.find((candidate) => candidate.id === playerId),
  })
  const player = playerQuery.data
  useDocumentTitle(player ? `${fullName(player)} · Statistics` : 'Statistics')

  // Club lookups for the filters. A manager who cannot read one of them simply does not get that filter's options.
  const seasonsQuery = useQuery({ queryKey: ['managed-club', clubId, 'seasons'], queryFn: () => listSeasons(clubId as string), enabled: Boolean(clubId) })
  const leaguesQuery = useQuery({ queryKey: ['managed-club', clubId, 'leagues'], queryFn: () => listLeagues(clubId as string), enabled: Boolean(clubId) })
  const sectionsQuery = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId as string), enabled: Boolean(clubId) })
  const teamsQuery = useQuery({ queryKey: ['managed-club', clubId, 'teams'], queryFn: () => listTeamsForClub(clubId as string), enabled: Boolean(clubId) })

  // Every filter offers only what the player has data for (spec 103 decision 22). Until the options load nothing is offered,
  // so unfiltered club-wide lists never show; a select with no options for this player is left out.
  const optionsQuery = usePlayerStatsFilterOptions(clubId, playerId)
  const available = optionsQuery.data

  const seasonOptions = useMemo(() => {
    const ids = new Set(available?.seasonIds ?? [])
    return (seasonsQuery.data ?? []).filter((season) => ids.has(season.id)).map((season) => ({ id: season.id, name: season.label }))
  }, [seasonsQuery.data, available])
  const leagueOptions = useMemo(() => {
    const ids = new Set(available?.leagueIds ?? [])
    return (leaguesQuery.data ?? []).filter((league) => ids.has(league.id)).map((league) => ({ id: league.id, name: league.name }))
  }, [leaguesQuery.data, available])
  const teamOptions = useMemo(() => {
    const ids = new Set(available?.teamIds ?? [])
    return (teamsQuery.data ?? []).filter((team) => ids.has(team.id)).map((team) => ({ id: team.id, name: team.name }))
  }, [teamsQuery.data, available])
  // The player's sections plus every ancestor, so the tree select stays connected.
  const sectionOptions = useMemo(() => {
    const all = sectionsQuery.data ?? []
    const byId = new Map(all.map((section) => [section.id, section]))
    const keep = new Set<string>()
    for (const id of available?.sectionIds ?? []) {
      let current = byId.get(id)
      while (current && !keep.has(current.id)) {
        keep.add(current.id)
        current = current.parentSectionId ? byId.get(current.parentSectionId) : undefined
      }
    }
    return all.filter((section) => keep.has(section.id))
  }, [sectionsQuery.data, available])
  const competitionOptions = COMPETITION_OPTIONS.filter((option) => available?.competitions.includes(option.value as StatsCompetition))

  // A saved choice that is not offered (gone, or no data for this player) falls back to none (All seasons / All leagues).
  const seasonId = saved.seasonId && (!available || !seasonsQuery.data || seasonOptions.some((option) => option.id === saved.seasonId)) ? saved.seasonId : null
  const leagueId = saved.leagueId && (!available || !leaguesQuery.data || leagueOptions.some((option) => option.id === saved.leagueId)) ? saved.leagueId : null

  const filters = { seasonId, leagueId, teamId, sectionId, competition }
  const hasFilters = Boolean(seasonId || leagueId || teamId || sectionId || competition)
  const statsQuery = usePlayerStats(clubId, playerId, filters, { keepPrevious: true })
  const stats = statsQuery.data

  const clearFilters = () => {
    updateSaved({ seasonId: null, leagueId: null })
    setTeamId(null)
    setSectionId(null)
    setCompetition(null)
  }

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (playerQuery.isError || (playerQuery.isSuccess && !player)) {
    return <EmptyState title="Couldn't load this player" description="Something went wrong loading this player. Please try again." />
  }

  const badge = player ? playerStatusBadge(playerStatusOf(player)) : null
  // A player with no published result at all and no filter set has nothing to filter: the bar is left out.
  const neverPlayed = Boolean(stats && stats.basis.matchesCounted === 0 && !hasFilters)

  let body
  if (statsQuery.isError) {
    body = (
      <EmptyState
        title="Couldn't load the statistics"
        description="Something went wrong loading this player's statistics."
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
  } else if (stats.basis.matchesCounted === 0) {
    body = hasFilters ? (
      <EmptyState
        title="No published results match these filters"
        description="Try a different season or team."
        action={
          <MuiButton variant="outlined" onClick={clearFilters} sx={{ minHeight: 44 }}>
            Clear filters
          </MuiButton>
        }
      />
    ) : (
      <EmptyState
        title="No published results yet"
        description="Statistics appear here once a published result has this player on its team list."
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
        <Typography variant="caption" color="text.secondary" data-testid="stats-basis" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
          {basisLine(stats, tab)}
        </Typography>
        {tab === 'batting' && <BattingTab stats={stats} />}
        {tab === 'bowling' && <BowlingTab stats={stats} />}
        {tab === 'fielding' && <FieldingTab stats={stats} />}
        {tab === 'awards' && <AwardsTab stats={stats} />}
      </>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeaderBand>
        <MuiButton
          component={RouterLink}
          to={`/manage/players/${playerId}`}
          variant="text"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ mb: 1, ml: -1, minHeight: 44, color: 'text.secondary' }}
        >
          Back to player
        </MuiButton>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            {player ? fullName(player) : 'Statistics'}
          </Typography>
          {badge && <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="player-status-badge" />}
        </Stack>
      </PageHeaderBand>

      <PlayerStatsTabs />

      {!neverPlayed && (
        <FilterBar
          density="compact"
          seasons={seasonOptions.length > 0 ? seasonOptions : undefined}
          leagues={leagueOptions.length > 0 ? leagueOptions : undefined}
          sections={sectionOptions.length > 0 ? sectionOptions : undefined}
          teams={teamOptions.length > 0 ? teamOptions : undefined}
          seasonId={seasonId}
          leagueId={leagueId}
          sectionId={sectionId}
          teamId={teamId}
          onSeasonChange={(value) => updateSaved({ seasonId: value })}
          onLeagueChange={(value) => updateSaved({ leagueId: value })}
          onSectionChange={setSectionId}
          onTeamChange={setTeamId}
          extraSelects={
            competitionOptions.length > 0
              ? [
                  {
                    key: 'competition',
                    label: 'Competition',
                    allLabel: 'All competitions',
                    options: competitionOptions,
                    value: competition ?? '',
                    onChange: (value) => setCompetition((value || null) as StatsCompetition | null),
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
