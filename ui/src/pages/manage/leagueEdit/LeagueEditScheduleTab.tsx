import { Box, Skeleton, Stack, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { LeagueFixtures } from '../../../components/LeagueFixtures'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'

export interface LeagueEditScheduleTabProps {
  leagueId: string
  hasSeasons: boolean
  selectedSeasonId: string
  matches: Match[]
  matchesLoading: boolean
  teamsById: Map<string, Team>
  onShare: () => void
}

// docs/specs/050-league-schedule-and-fixtures.md: the Schedule tab of Edit League, the season's matches (the season comes
// from the page's header pill), an Add match shortcut pre-filling League and Season, and Share. Keeps today's content;
// restyled in a later step of spec 095.
export function LeagueEditScheduleTab({
  leagueId,
  hasSeasons,
  selectedSeasonId,
  matches,
  matchesLoading,
  teamsById,
  onShare,
}: LeagueEditScheduleTabProps) {
  const navigate = useNavigate()

  return (
    <Box sx={{ gridColumn: '1 / -1' }}>
      {!hasSeasons ? (
        <Typography variant="body2" color="text.secondary">
          Create a season first — matches are scheduled for a league and a specific season.
        </Typography>
      ) : (
        <Stack spacing={4}>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="secondary"
              size="sm"
              startIcon={<AddIcon fontSize="small" />}
              onClick={() => navigate(`/manage/fixtures/matches/new?leagueId=${leagueId}&seasonId=${selectedSeasonId}`)}
              disabled={!selectedSeasonId}
            >
              Add Match
            </Button>

            <Button
              variant="secondary"
              size="sm"
              startIcon={<ShareOutlinedIcon fontSize="small" />}
              disabled={matchesLoading}
              onClick={onShare}
            >
              Share
            </Button>
          </Stack>

          {matchesLoading ? (
            <Skeleton variant="rounded" height={96} aria-label="Loading fixtures" />
          ) : (
            <LeagueFixtures matches={matches} teamsById={teamsById} />
          )}
        </Stack>
      )}
    </Box>
  )
}
