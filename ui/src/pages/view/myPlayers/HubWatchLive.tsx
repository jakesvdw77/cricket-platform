import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { Alert, Box, ButtonBase, Button as MuiButton, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { isAxiosError } from 'axios'
import { Button, compactButtonSx } from '../../../components/Button'
import { useMyPlayerMatch } from '../../../api/myPlayersApi'
import { BRAND, blackAlpha, creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { LeagueLogo } from './HubLeagueCard'
import { HubLiveScore } from './HubLiveScore'
import { LiveBadge } from './LiveBadge'
import { isHttps } from './leagueFormat'
import { matchTitle } from './matchFormat'
import { providerName, streamFrame, streamHost } from './streamFrame'

// docs/specs/135 (Watch Live): the TV page. Shown only while the match is live and a stream is set; otherwise "The stream is not on
// right now". A dark surround with a thin gold top rule, the scoreboard strip, a 16:9 frame (click to play first: no third party is
// contacted before the tap), the LiveScore slot (tv variant) under it and Open Stream as the fallback. This is the only file in the
// Hub that renders an iframe; the footer owns Back.
// Owner, 2026-11-12: Watch Live is a theatre page, not a panel inside the Hub. It covers the whole window (a portal to the body, because
// the Hub frame blurs its backdrop and so would trap a fixed child): a slim bar with Back, the match, the actions and LIVE, and the picture
// filling everything else, as large as 16:9 allows. The browser's own Full Screen (the button on the picture) removes the bar as well.
const BAR_PX = 52
const theatreSx = { position: 'fixed', inset: 0, zIndex: 1400, display: 'flex', flexDirection: 'column', bgcolor: '#000', color: HUB.cream } as const
const barSx = { flex: 'none', height: BAR_PX, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1, md: 2 }, bgcolor: BRAND.menu, borderBottom: `2px solid ${HUB.gold}` } as const
const stageSx = { flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' } as const
const screenSx = {
  aspectRatio: '16 / 9',
  width: `min(100vw, calc((100dvh - ${BAR_PX}px) * 16 / 9))`,
  maxHeight: '100%',
  position: 'relative',
  '&:fullscreen': { width: '100vw', height: '100vh', aspectRatio: 'auto', maxHeight: 'none' },
  bgcolor: '#000',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  textAlign: 'center',
  color: HUB.cream,
  overflow: 'hidden',
} as const

const goldButton = { ...compactButtonSx, bgcolor: HUB.gold, color: HUB.ink, borderRadius: '4px', '&:hover': { bgcolor: alpha(HUB.gold, 0.85) }, '&:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } } as const

function OpenStream({ url, gold }: { url: string; gold?: boolean }) {
  if (!isHttps(url)) return null
  return (
    <MuiButton
      variant={gold ? 'contained' : 'outlined'}
      size="small"
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="open-stream"
      sx={gold ? goldButton : { ...compactButtonSx, color: HUB.gold, borderColor: HUB.gold, bgcolor: 'transparent', borderRadius: '4px', '&:hover': { borderColor: HUB.gold, bgcolor: HUB.lineSoft }, '&:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } }}
    >
      Open Stream
    </MuiButton>
  )
}

function FullScreenButton({ target }: { target: RefObject<HTMLElement | null> }) {
  const [full, setFull] = useState(false)
  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === target.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [target])
  // Where the browser has no element full screen (an iPhone), the frame's own player control is the way.
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void target.current?.requestFullscreen?.()
  }
  return (
    <MuiButton
      variant="contained"
      size="small"
      onClick={toggle}
      data-testid="stream-fullscreen"
      aria-label={full ? 'Exit full screen' : 'Full screen'}
      startIcon={full ? <FullscreenExitIcon /> : <FullscreenIcon />}
      sx={{ ...compactButtonSx, position: 'absolute', top: 8, right: 8, zIndex: 2, bgcolor: blackAlpha(0.6), color: HUB.cream, borderRadius: '4px', '&:hover': { bgcolor: blackAlpha(0.8) }, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
    >
      {full ? 'Exit Full Screen' : 'Full Screen'}
    </MuiButton>
  )
}

export function HubWatchLive({ playerKey, matchId, onBack, backLabel = 'Back' }: { playerKey: string; matchId: string; onBack?: () => void; backLabel?: string }) {
  const query = useMyPlayerMatch(playerKey, matchId)
  const [playing, setPlaying] = useState(false)
  const screenRef = useRef<HTMLDivElement>(null)
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
  if (!match) return <Skeleton variant="rounded" height={260} sx={{ bgcolor: creamAlpha(0.12) }} aria-busy="true" />

  const stream = match.stream
  if (match.phase !== 'LIVE' || !stream) {
    return (
      <Box data-testid="hub-watch-off" sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2, color: HUB.muted }}>
        The stream is not on right now
      </Box>
    )
  }

  const title = matchTitle(match.home.name, match.away.name)
  const frame = streamFrame(stream, title)
  const host = streamHost(stream.url)
  const facts = [match.league?.name, match.playingAreaName || match.venue].filter(Boolean).join(' · ')
  const picture =
    frame && playing ? (
      <Box ref={screenRef} data-testid="stream-screen" sx={{ ...screenSx, display: 'block' }}>
        <FullScreenButton target={screenRef} />
        <Box component="iframe" data-testid="stream-frame" {...frame} allowFullScreen sx={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
      </Box>
    ) : frame ? (
      <ButtonBase
        onClick={() => setPlaying(true)}
        aria-label={`Tap to watch ${title}`}
        data-testid="stream-poster"
        sx={{ ...screenSx, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: -4 } }}
      >
        <Box sx={{ width: 72, height: 72, borderRadius: '50%', border: `2px solid ${HUB.gold}`, color: HUB.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PlayArrowIcon fontSize="large" />
        </Box>
        <Typography component="span" sx={{ fontWeight: 600, fontSize: 18 }}>Tap To Watch</Typography>
        <Typography component="span" sx={{ fontSize: 14, color: HUB.muted }}>{providerName(stream.provider)}, loads only after you tap</Typography>
      </ButtonBase>
    ) : (
      <Box data-testid="stream-fallback" sx={screenSx}>
        <Typography component="span" sx={{ fontSize: 18 }}>{host ? `This stream opens on ${host}` : 'This stream opens in a new tab'}</Typography>
        <OpenStream url={stream.url} gold />
      </Box>
    )
  return createPortal(
    <Box data-testid="hub-watch-live" role="region" aria-label={`Watch ${title}`} sx={theatreSx}>
      <Box data-testid="watch-scoreboard" sx={barSx}>
        {onBack && (
          <MuiButton onClick={onBack} startIcon={<ArrowBackIcon />} data-testid="watch-back" sx={{ ...compactButtonSx, flex: 'none', color: HUB.cream, minHeight: 40, '&:hover': { bgcolor: HUB.lineSoft }, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}>
            {backLabel}
          </MuiButton>
        )}
        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 1, fontFamily: HUB.display, fontWeight: 700, fontSize: { xs: 16, md: 20 }, lineHeight: 1.1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <LeagueLogo logoUrl={match.home.logoUrl ?? null} size={22} />
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.home.name}</Box>
          <Box component="span" sx={{ color: HUB.muted, fontFamily: 'inherit', fontSize: 13, fontWeight: 400 }}>versus</Box>
          <LeagueLogo logoUrl={match.away.logoUrl ?? null} size={22} />
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.away.name}</Box>
          {facts && <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' }, ml: 1, fontFamily: 'Barlow, sans-serif', fontWeight: 400, fontSize: 14, color: HUB.sand }}>{facts}</Box>}
        </Box>
        <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 1 }}>
          {frame && <Box sx={{ display: { xs: 'none', sm: 'block' } }}><OpenStream url={stream.url} /></Box>}
          <HubLiveScore source={match.liveScore} variant="header" />
          <LiveBadge />
        </Box>
      </Box>
      <Box sx={stageSx}>{picture}</Box>
    </Box>,
    document.body,
  )
}
