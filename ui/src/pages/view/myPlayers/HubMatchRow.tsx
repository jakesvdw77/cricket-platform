import { Box, Button as MuiButton, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { compactButtonSx } from '../../../components/Button'
import type { MyMatchSelection, MyMatchSummaryDto } from '../../../api/myPlayersApi'
import { useMyPlayerMatch } from '../../../api/myPlayersApi'
import { STATS_TONES, TICKER_TONES, creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { HubVenueLine, HubWeatherBadge } from './HubFixtureLocation'
import { LeagueLogo } from './HubLeagueCard'
import { HubLiveScore } from './HubLiveScore'
import { LiveBadge } from './LiveBadge'
import { hubPath } from './hubNav'
import { timeLabel } from './leagueFormat'
import { countdownLabel, elapsedLabel, matchPath, matchTitle, recentOutcome, recentResultLine, selectionLabel, watchPath } from './matchFormat'

// docs/specs/135 (Schedule > Matches rows): the whole row is one tap target (the title is a stretched link; inner buttons sit above it),
// 44 px, hover tint, gold focus ring, no chevron, no kebab. A live row has the gold edge and tint ("Your game" one step stronger).
const rowSx = (kind: 'live' | 'upcoming' | 'recent') =>
  ({
    position: 'relative',
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 0.75,
    p: 1.5,
    minHeight: 44,
    border: 1,
    borderColor: kind === 'live' ? HUB.gold : HUB.line,
    borderLeft: `4px solid ${kind === 'live' ? HUB.gold : HUB.line}`,
    borderRadius: '4px',
    bgcolor: kind === 'live' ? alpha(HUB.gold, 0.2) : creamAlpha(0.07),
    opacity: kind === 'recent' ? 0.72 : 1,
    '&:hover': { bgcolor: kind === 'live' ? alpha(HUB.gold, 0.26) : creamAlpha(0.12) },
    '&:focus-within': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
  }) as const

const stretchedLink = {
  color: 'inherit',
  textDecoration: 'none',
  outline: 'none',
  '&::after': { content: '""', position: 'absolute', inset: 0 },
} as const

export function SelectionTag({ selection }: { selection: MyMatchSelection | null | undefined }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={selectionLabel(selection)}
      data-testid="selection-tag"
      sx={{ height: 22, borderRadius: '4px', fontSize: 12, fontWeight: 600, color: HUB.sand, borderColor: HUB.line, bgcolor: 'transparent', justifySelf: 'start' }}
    />
  )
}

function Side({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <LeagueLogo logoUrl={logoUrl ?? null} size={24} name={name} />
      <Typography component="span" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 21, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{name}</Typography>
    </Box>
  )
}

const ANSWER_TAG = {
  AVAILABLE: { text: 'Available', color: TICKER_TONES.win },
  UNAVAILABLE: { text: 'Unavailable', color: TICKER_TONES.live },
  UNSURE: { text: 'Not Sure', color: STATS_TONES.partly },
} as const

// Upcoming rows only (owner, 2026-11-12): the player's own poll answer. A poll still open links to Availability so it can be answered
// or changed (the link sits above the row's stretched link); a closed poll is just the answer, or "No Answer" when none was given.
function AvailabilityTag({ playerKey, availability }: { playerKey: string; availability: NonNullable<MyMatchSummaryDto['availability']> }) {
  const look = availability.answer ? ANSWER_TAG[availability.answer] : null
  const text = look ? look.text : availability.pollOpen ? 'Answer Availability' : 'No Answer'
  const color = look ? look.color : availability.pollOpen ? HUB.gold : HUB.muted
  const sx = { height: 22, px: 1, display: 'inline-flex', alignItems: 'center', borderRadius: '4px', fontSize: 12, fontWeight: 600, color, border: `1px solid ${color}`, textDecoration: 'none', justifySelf: 'start' } as const
  return availability.pollOpen ? (
    <Box component={RouterLink} to={hubPath(playerKey, 'availability')} data-testid="availability-tag" aria-label={`Availability: ${text}`} sx={{ ...inner, ...sx, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}>{text}</Box>
  ) : (
    <Box component="span" data-testid="availability-tag" sx={sx}>{text}</Box>
  )
}

const inner = { position: 'relative', zIndex: 1 } as const

// The live row's Follow Live Score: the list carries only `hasLiveScore`, so the source is read from the match (the same cached read
// the match page uses) and handed to the seam component.
function LiveRowScore({ playerKey, matchId }: { playerKey: string; matchId: string }) {
  const match = useMyPlayerMatch(playerKey, matchId)
  return <HubLiveScore source={match.data?.liveScore} variant="row" />
}

// The top line of an upcoming row: the time and countdown on the left, the match-hours weather badge in the top right corner (a phone
// drops it under the time). The position for the forecast comes from the match read.
function UpcomingHeader({ playerKey, matchId, text }: { playerKey: string; matchId: string; text: string }) {
  const match = useMyPlayerMatch(playerKey, matchId)
  return (
    <Box sx={{ ...inner, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 0.5, pointerEvents: 'none' }}>
      <Typography sx={{ fontSize: 14, color: HUB.muted }}>{text}</Typography>
      {match.data && <HubWeatherBadge row={match.data} />}
    </Box>
  )
}

// The VENUE line of a row. Get Directions needs the stored position, which only the match read carries; a recent row has none.
function RowVenue({ playerKey, row, withDirections }: { playerKey: string; row: MyMatchSummaryDto; withDirections: boolean }) {
  const match = useMyPlayerMatch(playerKey, row.matchId, withDirections)
  return (
    <Box sx={inner}>
      <HubVenueLine row={match.data} venue={row.venue} withDirections={withDirections} />
    </Box>
  )
}

// Green win, coral loss, amber tie; each also says its letter, so colour is never the only cue.
const OUTCOME_LOOK = {
  WON: { letter: 'W', color: TICKER_TONES.win },
  LOST: { letter: 'L', color: TICKER_TONES.live },
  TIED: { letter: 'T', color: STATS_TONES.partly },
} as const

function OutcomeChip({ outcome }: { outcome: keyof typeof OUTCOME_LOOK }) {
  const { letter, color } = OUTCOME_LOOK[outcome]
  return (
    <Box
      component="span"
      data-testid="match-outcome-chip"
      sx={{ flex: 'none', minWidth: 22, height: 22, px: 0.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: 12, fontWeight: 700, color, border: `1px solid ${color}` }}
    >
      {letter}
    </Box>
  )
}

export interface HubMatchRowProps {
  playerKey: string
  row: MyMatchSummaryDto
  now: Date
  // Where the list was (`matches:recent`), carried to the match page so its Back returns to the same pill.
  from?: string
}

export function HubMatchRow({ playerKey, row, now, from }: HubMatchRowProps) {
  const kind = row.phase === 'LIVE' ? 'live' : row.phase === 'RECENT' ? 'recent' : 'upcoming'
  const title = matchTitle(row.home.name, row.away.name)
  const time = timeLabel(row.time)
  const outcome = kind === 'recent' ? recentOutcome(row) : null
  return (
    <Box component="article" data-testid="hub-match-row" data-phase={row.phase} sx={rowSx(kind)}>
      {kind === 'live' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <LiveBadge />
          <Typography component="span" data-testid="match-elapsed" sx={{ fontSize: 14, color: HUB.muted }}>{elapsedLabel(row.startedAt, now)}</Typography>
        </Box>
      )}
      {kind === 'upcoming' && <UpcomingHeader playerKey={playerKey} matchId={row.matchId} text={[time, countdownLabel(row.date, now)].filter(Boolean).join(' · ')} />}
      <Box component={RouterLink} to={matchPath(playerKey, row.matchId, from)} aria-label={title} sx={{ ...stretchedLink, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.25, '&:focus-visible': { outline: 'none' } }}>
        <Side name={row.home.name} logoUrl={row.home.logoUrl} />
        <Typography component="span" sx={{ fontSize: 14, color: HUB.muted, pl: 0.5 }}>versus</Typography>
        <Side name={row.away.name} logoUrl={row.away.logoUrl} />
      </Box>
      <Typography data-testid="match-league-line" sx={{ fontSize: 14, color: HUB.muted }}>{row.league || 'Friendly'}</Typography>
      <RowVenue playerKey={playerKey} row={row} withDirections={kind !== 'recent'} />
      {kind === 'recent' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.25 }}>
          {row.result && (
            <Typography sx={{ fontSize: 15 }}>
              {row.home.name} {row.result.homeScore} · {row.away.name} {row.result.awayScore}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {outcome && <OutcomeChip outcome={outcome} />}
            <Typography data-testid="match-result-line" sx={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere', color: outcome ? OUTCOME_LOOK[outcome].color : row.result ? HUB.gold : HUB.muted }}>{recentResultLine(row)}</Typography>
          </Box>
        </Box>
      )}
      {kind !== 'recent' && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <SelectionTag selection={row.selection} />
          {kind === 'upcoming' && row.availability && <AvailabilityTag playerKey={playerKey} availability={row.availability} />}
        </Box>
      )}
      {kind === 'live' && (
        <Box sx={{ ...inner, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {row.hasLiveScore && <LiveRowScore playerKey={playerKey} matchId={row.matchId} />}
          {row.hasStream && (
            <MuiButton
              variant="contained"
              size="small"
              component={RouterLink}
              to={watchPath(playerKey, row.matchId, from)}
              data-testid="watch-live"
              sx={{ ...compactButtonSx, bgcolor: HUB.gold, color: HUB.ink, borderRadius: '4px', '&:hover': { bgcolor: alpha(HUB.gold, 0.85) }, '&:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } }}
            >
              Watch Live
            </MuiButton>
          )}
        </Box>
      )}
    </Box>
  )
}
