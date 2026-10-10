import { Box, Skeleton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { ContentControlsLine } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
import { LeagueFixturesTable } from '../league/LeagueFixturesTable'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'

export interface LeagueEditScheduleTabProps {
  leagueId: string
  hasSeasons: boolean
  selectedSeasonId: string
  seasonLabel: string
  matches: Match[]
  matchesLoading: boolean
  teamsById: Map<string, Team>
  onShare: () => void
}

// docs/specs/095-league-edit-gold-standard.md (Schedule tab): the season's matches (the season comes from the page's header
// pill) as the league page's zebra table, under one content line: the scope on the left, Share and the filled Add match
// (pre-filling League and Season) on the right. No filters: every match of the season is shown.
export function LeagueEditScheduleTab({
  leagueId,
  hasSeasons,
  selectedSeasonId,
  seasonLabel,
  matches,
  matchesLoading,
  teamsById,
  onShare,
}: LeagueEditScheduleTabProps) {
  const navigate = useNavigate()

  if (!hasSeasons) {
    return (
      <Box sx={{ gridColumn: '1 / -1' }}>
        <Typography variant="body2" color="text.secondary">
          Create a season first: matches are scheduled for a league and a specific season.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ContentControlsLine
        scope={`Showing ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}${seasonLabel ? ` · ${seasonLabel}` : ''}`}
        pinned={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button variant="secondary" size="sm" startIcon={<ShareOutlinedIcon fontSize="small" />} disabled={matchesLoading} onClick={onShare}>
              Share
            </Button>
            <Button
              size="sm"
              startIcon={<AddIcon fontSize="small" />}
              onClick={() => navigate(`/manage/fixtures/matches/new?leagueId=${leagueId}&seasonId=${selectedSeasonId}`)}
              disabled={!selectedSeasonId}
            >
              Add match
            </Button>
          </Box>
        }
      />

      {matchesLoading ? (
        <Skeleton variant="rounded" height={96} aria-label="Loading fixtures" />
      ) : matches.length > 0 ? (
        <LeagueFixturesTable matches={matches} teamsById={teamsById} />
      ) : (
        <EmptyState title="No fixtures yet" description="No matches scheduled for this league and season yet." />
      )}
    </Box>
  )
}
