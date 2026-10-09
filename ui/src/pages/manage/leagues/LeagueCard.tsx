import { Box, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { RecordCard } from '../../../components/RecordCard'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { Countdown, useCountdown } from '../../../components/Countdown'
import { SelectionGauge } from '../../../components/SelectionGauge'
import { SocialLinksRow } from '../../../components/marketing/SocialLinksRow'
import type { SocialLink } from '../../../components/marketing/SocialLinksRow'
import type { League } from '../../../api/leagueApi'
import { formatMatchDateTime } from '../availability/pollHelpers'
import { leagueBadges } from './leagueBadges'
import { LeagueTeamAvatars } from './LeagueTeamAvatars'

export function leagueSocialLinks(league: League): SocialLink[] {
  return [...(league.website ? [{ platform: 'website', url: league.website }] : []), ...league.socialLinks]
}

// docs/specs/091-leagues-gold-standard.md (B): one RecordCard per league, built like the match and poll cards - the
// format and Active badges under the title, the website and social icons in the corner, a Next match strip (amber within
// 24 hours of the kickoff), a Matches played gauge, every team of the season and an icon-over-caption footer. The whole
// card opens the Schedule for the chosen season. Deactivate/Reactivate lives on the edit screen (038).
export function LeagueCard({ league, seasonId }: { league: League; seasonId?: string }) {
  const navigate = useNavigate()
  const search = seasonId ? `?seasonId=${seasonId}` : ''
  const base = `/manage/fixtures/leagues/${league.id}`
  const teams = league.teams ?? []
  const matchCount = league.matchCount ?? 0
  const playedCount = league.playedCount ?? 0
  const links = leagueSocialLinks(league)
  const next = useCountdown(league.nextMatchDate)

  return (
    <RecordCard
      title={league.name}
      titleWrap
      badgesBelow
      avatar={{ imageUrl: league.logoUrl, fallback: <EmojiEventsOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badges={leagueBadges(league)}
      // position: relative paints the links above the card's stretched link (059).
      headerActions={
        links.length > 0 ? (
          <Box data-testid="league-social-links" sx={{ position: 'relative' }}>
            <SocialLinksRow links={links} size="small" />
          </Box>
        ) : undefined
      }
      viewTo={`${base}/schedule${search}`}
      footerButtons={[
        { label: 'Schedule', icon: <EventOutlinedIcon fontSize="small" />, onClick: () => navigate(`${base}/schedule${search}`) },
        { label: 'Teams', icon: <GroupsOutlinedIcon fontSize="small" />, onClick: () => navigate(`${base}/teams${search}`) },
        {
          label: 'Conditions',
          icon: <DescriptionOutlinedIcon fontSize="small" />,
          onClick: () => navigate(`${base}/conditions${search}`),
        },
        { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => navigate(`${base}/edit`) },
      ]}
    >
      {league.nextMatchDate ? (
        <CardTimeStrip
          testId="league-next-match"
          tone={next.warn ? 'warning' : 'neutral'}
          icon={<EventOutlinedIcon fontSize="small" />}
          label="Next match"
          value={formatMatchDateTime(league.nextMatchDate)}
          trailing={<Countdown target={league.nextMatchDate} phrase="to go" ariaPrefix="Starts in" />}
        />
      ) : (
        <Box
          data-testid="league-next-match"
          sx={{ px: 1.5, py: 1, borderRadius: 1, border: 1, borderStyle: 'dashed', borderColor: 'divider', color: 'text.secondary' }}
        >
          <Typography variant="body2">{matchCount === 0 ? 'No matches scheduled yet' : 'No more matches this season'}</Typography>
        </Box>
      )}

      {matchCount > 0 && (
        <Stack spacing={0.75} data-testid="league-progress">
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
            <Typography variant="body2" component="h4" fontWeight={700}>
              Matches played
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {playedCount} of {matchCount}
            </Typography>
          </Stack>
          <SelectionGauge
            picked={playedCount}
            size={matchCount}
            ariaLabel="Matches played"
            pickedLabel="Played"
            completeLabel="Season complete"
            testIdPrefix="league-gauge"
          />
        </Stack>
      )}

      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
          <Typography variant="body2" component="h4" fontWeight={700}>
            Teams
          </Typography>
          {teams.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {teams.length} in this season
            </Typography>
          )}
        </Stack>
        <LeagueTeamAvatars teams={league.teams} />
      </Stack>
    </RecordCard>
  )
}
