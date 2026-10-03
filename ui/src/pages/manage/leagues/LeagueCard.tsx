import { Box, Chip, Divider, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import UpcomingOutlinedIcon from '@mui/icons-material/UpcomingOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { RecordCard, badgeSx } from '../../../components/RecordCard'
import { DetailLine } from '../../../components/DetailLine'
import { CardProgressBar } from '../../../components/CardProgressBar'
import { SocialLinksRow } from '../../../components/marketing/SocialLinksRow'
import type { SocialLink } from '../../../components/marketing/SocialLinksRow'
import type { League } from '../../../api/leagueApi'
import { resolveCountdownLabel } from '../../../utils/nextMatchCountdown'
import { formatMatchDate, formatMatchDateTime } from '../availability/pollHelpers'
import { leagueBadges } from './leagueBadges'
import { LeagueTeamAvatars } from './LeagueTeamAvatars'

const LABEL_WIDTH = 78

function countdownText(matchDate: string): string {
  const { label, value } = resolveCountdownLabel(matchDate, new Date())
  if (label === 'today') return 'today'
  if (label === 'tomorrow') return 'tomorrow'
  return `in ${value} days`
}

// docs/specs/071-league-card-redesign.md: one RecordCard per league, built like the match card (069)
// - badges above a wrapping title, stacked details, a progress block, every team of the current
// season, social icons and an icon-over-caption footer that opens the 072 view pages. Clicking the
// card opens the Schedule. Deactivate/Reactivate lives on the edit screen (038).
export function LeagueCard({ league }: { league: League }) {
  const navigate = useNavigate()
  const base = `/manage/fixtures/leagues/${league.id}`
  const teams = league.teams ?? []
  const matchCount = league.matchCount ?? 0
  const playedCount = league.playedCount ?? 0
  const toGo = Math.max(matchCount - playedCount, 0)
  const socialLinks: SocialLink[] = [
    ...(league.website ? [{ platform: 'website', url: league.website }] : []),
    ...league.socialLinks,
  ]

  return (
    <RecordCard
      title={league.name}
      titleWrap
      badgesAbove
      avatar={{ imageUrl: league.logoUrl, fallback: <EmojiEventsOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badges={leagueBadges(league, { teamCount: teams.length, seasonLabel: league.currentSeasonLabel })}
      viewTo={`${base}/schedule`}
      footerButtons={[
        { label: 'Schedule', icon: <EventOutlinedIcon fontSize="small" />, onClick: () => navigate(`${base}/schedule`) },
        { label: 'Teams', icon: <GroupsOutlinedIcon fontSize="small" />, onClick: () => navigate(`${base}/teams`) },
        {
          label: 'Conditions',
          icon: <DescriptionOutlinedIcon fontSize="small" />,
          onClick: () => navigate(`${base}/conditions`),
        },
        { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => navigate(`${base}/edit`) },
      ]}
    >
      <Stack spacing={1.25} sx={{ py: 0.5 }}>
        {league.firstMatchDate ? (
          <DetailLine
            icon={<EventOutlinedIcon fontSize="small" />}
            label="First match"
            labelWidth={LABEL_WIDTH}
            value={formatMatchDate(league.firstMatchDate)}
          />
        ) : (
          <DetailLine
            icon={<EventOutlinedIcon fontSize="small" />}
            label="First match"
            labelWidth={LABEL_WIDTH}
            value="Not scheduled yet"
            muted
          />
        )}
        {league.nextMatchDate ? (
          <DetailLine
            icon={<UpcomingOutlinedIcon fontSize="small" />}
            label="Next match"
            labelWidth={LABEL_WIDTH}
            value={
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <span>{formatMatchDateTime(league.nextMatchDate)}</span>
                <Chip size="small" label={countdownText(league.nextMatchDate)} sx={badgeSx('open')} />
              </Stack>
            }
          />
        ) : (
          <DetailLine
            icon={<UpcomingOutlinedIcon fontSize="small" />}
            label="Next match"
            labelWidth={LABEL_WIDTH}
            value="None scheduled"
            muted
          />
        )}
        {league.lastMatchDate ? (
          <DetailLine
            icon={<FlagOutlinedIcon fontSize="small" />}
            label="Last match"
            labelWidth={LABEL_WIDTH}
            value={formatMatchDate(league.lastMatchDate)}
          />
        ) : (
          <DetailLine
            icon={<FlagOutlinedIcon fontSize="small" />}
            label="Last match"
            labelWidth={LABEL_WIDTH}
            value="Not scheduled yet"
            muted
          />
        )}
        <DetailLine
          icon={<GroupsOutlinedIcon fontSize="small" />}
          label="Playing XI"
          labelWidth={LABEL_WIDTH}
          value={`${league.maxPlayingXiSize} players`}
        />
        {(league.minAge != null || league.maxAge != null) && (
          <DetailLine
            icon={<CakeOutlinedIcon fontSize="small" />}
            label="Age range"
            labelWidth={LABEL_WIDTH}
            value={`${league.minAge ?? 'Any'}–${league.maxAge ?? 'Any'}`}
          />
        )}
      </Stack>

      <Stack spacing={1} data-testid="league-progress">
        <Divider />
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
          <Typography variant="subtitle2" component="h4" fontWeight={700}>
            Matches played
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {playedCount} of {matchCount}
          </Typography>
        </Stack>
        <CardProgressBar
          value={playedCount}
          max={matchCount}
          ariaLabel="Matches played"
          valueText={`${playedCount} of ${matchCount} played`}
        />
        <Typography variant="caption" color="text.secondary">
          {matchCount === 0 ? 'No matches scheduled yet' : `${playedCount} played · ${toGo} to go`}
        </Typography>
      </Stack>

      <Stack spacing={1.25}>
        <Divider />
        <LeagueTeamAvatars teams={league.teams} />
      </Stack>

      {socialLinks.length > 0 && (
        <Stack spacing={1}>
          <Divider />
          {/* position: relative paints the links above the title's stretched card link (059). */}
          <Box data-testid="league-social-links" sx={{ position: 'relative', alignSelf: 'flex-start', ml: -0.75 }}>
            <SocialLinksRow links={socialLinks} size="small" />
          </Box>
        </Stack>
      )}
    </RecordCard>
  )
}
