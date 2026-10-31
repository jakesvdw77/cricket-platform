import { useLocation } from 'react-router-dom'
import { Box, Stack, Typography, alpha } from '@mui/material'
import { BrandIcon } from '../../../components/BrandIcon'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { RecordCard } from '../../../components/RecordCard'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { Countdown, useCountdown } from '../../../components/Countdown'
import { SelectionGauge } from '../../../components/SelectionGauge'
import { SocialLinksRow } from '../../../components/marketing/SocialLinksRow'
import type { SocialLink } from '../../../components/marketing/SocialLinksRow'
import type { League } from '../../../api/leagueApi'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { formatMatchDateTime } from '../availability/pollHelpers'
import { leagueBadges } from './leagueBadges'
import { LeagueRowMenu } from './LeagueRowMenu'
import { LeagueTeamAvatars } from './LeagueTeamAvatars'

export function leagueSocialLinks(league: League): SocialLink[] {
  return [...(league.website ? [{ platform: 'website', url: league.website }] : []), ...league.socialLinks]
}

// docs/specs/091-leagues-gold-standard.md (B): one RecordCard per league, built like the match and poll cards - the
// format and Active badges under the title, the website and social icons in the corner, a Next match strip (amber within
// 24 hours of the kickoff), a Matches played gauge, every team of the season and one Actions kebab in the corner (no footer bar). The whole
// card opens the Schedule for the chosen season. Deactivate/Reactivate lives on the edit screen (038).
// Why an active league shows under "Setup needed" (the backend's LeagueListRow.needsAttention): no teams entered, no
// matches scheduled in the season. Empty for an inactive league or one that is fully set up.
export function leagueSetupReasons(league: League): string[] {
  if (!league.active) {
    return []
  }
  const reasons: string[] = []
  if ((league.teams ?? []).length === 0) {
    reasons.push('No teams entered')
  }
  if ((league.matchCount ?? 0) === 0) {
    reasons.push('No matches scheduled in this season')
  }
  return reasons
}

export interface LeagueCardProps {
  league: League
  seasonId?: string
  // The card's Actions menu (page-anatomy section 6, top-right corner): the page owns the dialogs. An absent handler leaves its item out.
  onShare?: (league: League) => void
  onDuplicate?: (league: League) => void
}

export function LeagueCard({ league, seasonId, onShare, onDuplicate }: LeagueCardProps) {
  const location = useLocation()
  const base = `/manage/fixtures/leagues/${league.id}`
  const search = seasonId ? `?seasonId=${seasonId}` : ''
  const teams = league.teams ?? []
  const matchCount = league.matchCount ?? 0
  const playedCount = league.playedCount ?? 0
  const links = leagueSocialLinks(league)
  const next = useCountdown(league.nextMatchDate)
  const setupReasons = leagueSetupReasons(league)

  return (
    <RecordCard
      flat
      title={league.name}
      titleWrap
      badgesBelow
      avatar={{ imageUrl: league.logoUrl, fallback: <BrandIcon name="nav/cricket-leagues" size={40} surface="none" />, shape: 'rounded' }}
      badges={leagueBadges(league)}
      // position: relative paints the links above the card's stretched link (059).
      headerActions={
        // Desktop: the icon hit areas shrink from 32 to 26 px and the gaps go, so the corner icons sit close together (phones keep 44 px targets).
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0 }, '& .MuiIconButton-root': { width: { md: 26 }, height: { md: 26 } } }}>
          {links.length > 0 && (
            <Box data-testid="league-social-links" sx={{ position: 'relative' }}>
              <SocialLinksRow links={links} size="small" />
            </Box>
          )}
          <LeagueRowMenu league={league} seasonId={seasonId} onShare={onShare} onDuplicate={onDuplicate} testId="league-card-actions" />
        </Box>
      }
      viewTo={withReturnTo(`${base}/schedule${search}`, currentOrigin(location), 'Leagues')}
      // No footer action bar (page-anatomy section 6): the kebab in the corner holds every action.
      footerActions={null}
    >
      {setupReasons.length > 0 && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          data-testid="league-setup-needed"
          sx={{ px: 1.25, py: 0.75, borderRadius: 1, bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14), color: 'text.primary' }}
        >
          <WarningAmberOutlinedIcon sx={{ fontSize: 16, mt: '2px' }} />
          <Typography variant="caption" fontWeight={600}>
            Setup needed: {setupReasons.join('. ')}
          </Typography>
        </Stack>
      )}

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
