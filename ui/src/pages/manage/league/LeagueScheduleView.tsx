import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { LeagueFixtures } from '../../../components/LeagueFixtures'
import { NextMatchCountdown } from '../../../components/NextMatchCountdown'
import { ShareScheduleDialog } from '../../../components/ShareScheduleDialog'
import type { ShareScheduleTeamOption } from '../../../components/ShareScheduleDialog'
import { listAllMatches } from '../../../api/matchApi'
import { resolveNextMatchCountdown } from '../../../utils/nextMatchCountdown'
import { generateLeagueSchedulePdf } from '../../../utils/leagueSchedulePdf'
import { generateLeagueSchedulePoster } from '../../../utils/leagueSchedulePoster'
import { generateLeagueScheduleIcs } from '../../../utils/leagueScheduleIcs'
import { triggerDownload } from '../../../utils/triggerDownload'
import { CardHeaderRow } from './leagueViewParts'
import { useLeagueView } from './leagueViewContext'

// docs/specs/072-league-view-pages.md section 5: the Schedule view - Fixtures card with Share
// schedule, the next-match countdown and the fixtures list, built from every match of the selected
// league and season (listAllMatches), not just the first page.
export default function LeagueScheduleView() {
  const { clubId, leagueId, league, seasons, selectedSeasonId, seasonLabel, teamsById, affiliationsForSeason } =
    useLeagueView()
  const theme = useTheme()
  const [shareOpen, setShareOpen] = useState(false)

  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'matches', selectedSeasonId],
    queryFn: () => listAllMatches(clubId, { leagueId, seasonId: selectedSeasonId }),
    enabled: Boolean(selectedSeasonId),
  })

  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data])

  // Computed once per match-list change, never on a timer (docs/specs/051's Non-goals).
  const nextMatchCountdown = useMemo(() => resolveNextMatchCountdown(matches, new Date()), [matches])

  const shareTeams: ShareScheduleTeamOption[] = affiliationsForSeason.map((affiliation) => ({
    teamId: affiliation.teamId,
    teamName: teamsById.get(affiliation.teamId)?.name ?? 'Unknown team',
  }))

  const handleSharePdf = async (teamFilter: ShareScheduleTeamOption | null) => {
    const url = await generateLeagueSchedulePdf(matches, teamsById, league.name, seasonLabel, teamFilter)
    window.open(url, '_blank', 'noopener')
  }

  const handleSharePoster = async (teamFilter: ShareScheduleTeamOption | null) => {
    const url = await generateLeagueSchedulePoster(
      matches,
      teamsById,
      league.name,
      seasonLabel,
      teamFilter,
      theme.palette.primary.main,
    )
    triggerDownload(url, `${league.name}-poster.png`)
  }

  const handleShareCalendar = async (team: ShareScheduleTeamOption) => {
    const url = generateLeagueScheduleIcs(matches, teamsById, league.name, seasonLabel, team)
    triggerDownload(url, `${team.teamName}-schedule.ics`)
  }

  return (
    <>
      <Card>
        <CardHeaderRow
          title="Fixtures"
          action={
            <Button
              variant="ghost"
              size="sm"
              startIcon={<ShareOutlinedIcon fontSize="small" />}
              disabled={matchesQuery.isLoading}
              onClick={() => setShareOpen(true)}
            >
              Share schedule
            </Button>
          }
        />

        {seasons.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No seasons yet — matches are scheduled for a league and a specific season.
          </Typography>
        ) : matchesQuery.isLoading ? (
          // Loading is not an empty season: no empty state or countdown until the matches arrive.
          <Skeleton variant="rounded" height={96} aria-label="Loading fixtures" />
        ) : (
          <Stack spacing={3}>
            <NextMatchCountdown countdown={nextMatchCountdown} teamsById={teamsById} />
            <LeagueFixtures matches={matches} teamsById={teamsById} />
          </Stack>
        )}
      </Card>

      <ShareScheduleDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        leagueName={league.name}
        seasonLabel={seasonLabel}
        teams={shareTeams}
        onSharePdf={handleSharePdf}
        onSharePoster={handleSharePoster}
        onShareCalendar={handleShareCalendar}
      />
    </>
  )
}
