import { isAxiosError } from 'axios'
import { Alert, Box, Chip, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Button } from '../../../components/Button'
import { useMyPlayerMatch } from '../../../api/myPlayersApi'
import type { MyMatchDto } from '../../../api/myPlayersApi'
import { blackAlpha, creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { LeagueLogo } from './HubLeagueCard'
import { HubLiveActions } from './HubLiveActions'
import { HubLiveScore } from './HubLiveScore'
import { HubMatchLinks } from './HubMatchLinks'
import { HubWeatherPanel } from './HubFixtureLocation'
import { HubMatchFigures } from './HubMatchFigures'
import { HubMatchSide } from './HubMatchSide'
import { LiveBadge } from './LiveBadge'
import { answerLabel, statusBadgeLabel } from './matchFormat'
import { useNow } from './useNow'

// docs/specs/135 (Match page): read only. The footer owns Back (no Back, Manage, Edit or Share here). One status badge, four static
// figures, the live entries (LiveScore seam, Watch Live), forecast and directions, the player's own availability answer, both teams
// and the published result. Everything shown is what the server decided; the client does not derive selection or the XI.
export interface HubMatchProps {
  playerKey: string
  matchId: string
  from?: string | null
  onAnswerAvailability: () => void
}

const panelSx = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.75, border: 1, borderColor: HUB.line, borderRadius: '4px', p: 1.5, bgcolor: blackAlpha(0.22) } as const
const sectionTitle = { fontFamily: HUB.display, fontWeight: 600, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', color: HUB.sand } as const

function Skeletons() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }} aria-busy="true" data-testid="hub-match-loading">
      <Skeleton variant="rounded" height={64} sx={{ bgcolor: creamAlpha(0.12) }} />
      <Skeleton variant="rounded" height={56} sx={{ bgcolor: creamAlpha(0.12) }} />
      <Skeleton variant="rounded" height={120} sx={{ bgcolor: creamAlpha(0.12) }} />
    </Box>
  )
}

function Availability({ match, onAnswer }: { match: MyMatchDto; onAnswer: () => void }) {
  const availability = match.availability
  if (!availability) return null
  return (
    <Box data-testid="match-availability" component="section" aria-label="Your Availability" sx={panelSx}>
      <Typography component="h3" sx={sectionTitle}>Your Availability</Typography>
      <Typography sx={{ fontSize: 15, color: HUB.muted }}>
        {answerLabel(availability.answer)} {availability.pollOpen ? 'Poll open.' : 'Poll closed.'}
      </Typography>
      {availability.pollOpen && (
        <Button variant="secondary" size="compact" onClick={onAnswer} sx={{ alignSelf: 'flex-start', color: HUB.gold, borderColor: HUB.gold, bgcolor: 'transparent', borderRadius: '4px', '&:hover': { borderColor: HUB.gold, bgcolor: alpha(HUB.gold, 0.12), backgroundImage: 'none' } }}>
          Answer Availability
        </Button>
      )}
    </Box>
  )
}

export function HubMatch({ playerKey, matchId, from, onAnswerAvailability }: HubMatchProps) {
  const query = useMyPlayerMatch(playerKey, matchId)
  const now = useNow()
  const match = query.data

  if (query.isError) {
    const missing = isAxiosError(query.error) && query.error.response?.status === 404
    return missing ? (
      <Alert severity="info" data-testid="hub-match-missing">This match is not available</Alert>
    ) : (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => query.refetch()}>Retry</Button>}>
        We could not load this match. Please try again.
      </Alert>
    )
  }
  if (!match) return <Skeletons />

  const live = match.phase === 'LIVE'
  const mine = match.home.mine ? match.home : match.away.mine ? match.away : match.home
  return (
    <Box data-testid="hub-match" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      {/* The status badge (or LIVE) is always in the top right corner of the title block; a phone keeps it under the title. */}
      <Box data-testid="match-title-block" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.75 }}>
        <Typography component="h2" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 28, lineHeight: 1.1, minWidth: 0, overflowWrap: 'anywhere', display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.5 }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <LeagueLogo logoUrl={match.home.logoUrl ?? null} size={28} name={match.home.name} />
            <span>{match.home.name}</span>
          </Box>
          <span>versus</span>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <LeagueLogo logoUrl={match.away.logoUrl ?? null} size={28} name={match.away.name} />
            <span>{match.away.name}</span>
          </Box>
        </Typography>
        {/* Owner, 2026-11-12 (option 3): while a game is on, Watch Live and Live Score sit beside the LIVE badge in the header. A phone puts them on a row of
            their own under the title. Each shows only when it applies. */}
        <Box data-testid="match-header-actions" sx={{ flex: 'none', display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, width: { xs: '100%', sm: 'auto' } }}>
          {live && <HubLiveActions playerKey={playerKey} matchId={match.matchId} from={from} hasStream={Boolean(match.stream)} score={<HubLiveScore source={match.liveScore} variant="header" />} />}
          <Box sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
            {live ? (
              <LiveBadge />
            ) : (
              <Chip size="small" variant="outlined" label={statusBadgeLabel(match)} data-testid="match-status-badge" sx={{ height: 24, borderRadius: '12px', fontSize: 13, fontWeight: 600, color: HUB.sand, borderColor: HUB.line, bgcolor: 'transparent' }} />
            )}
          </Box>
        </Box>
      </Box>
      {match.phase === 'RECENT' && <HubMatchLinks stream={match.stream} liveScore={match.liveScore} />}
      <HubMatchFigures match={match} now={now} />
      <HubWeatherPanel match={match} />
      {match.phase === 'UPCOMING' && <HubLiveScore source={match.liveScore} variant="card" owner={{ name: mine.name, logoUrl: mine.logoUrl }} />}
      <Availability match={match} onAnswer={onAnswerAvailability} />
      <HubMatchSide side={match.home} />
      <HubMatchSide side={match.away} />
      {match.result && (
        <Box data-testid="match-result" component="section" aria-label="Result" sx={panelSx}>
          <Typography component="h3" sx={sectionTitle}>Result</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{match.home.name}</Typography>
            <Typography sx={{ fontSize: 17, flex: 'none' }}>{match.result.homeScore}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{match.away.name}</Typography>
            <Typography sx={{ fontSize: 17, flex: 'none' }}>{match.result.awayScore}</Typography>
          </Box>
          {match.result.resultLine && <Typography sx={{ fontSize: 16, color: HUB.gold }}>{match.result.resultLine}</Typography>}
        </Box>
      )}
    </Box>
  )
}
