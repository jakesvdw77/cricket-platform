import { Box, Button as MuiButton } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ScoreboardOutlinedIcon from '@mui/icons-material/ScoreboardOutlined'
import { compactButtonSx } from '../../../components/Button'
import type { LiveScoreSource, MyMatchStreamDto } from '../../../api/myPlayersApi'
import { HUB } from './hubStyle'
import { isHttps } from './leagueFormat'

// Owner, 2026-11-12: a finished match keeps its links. Watch Stream (the recording, where the club kept the stream link) and Online
// Scorecard (the club's scoring site) open in a new tab, https only, never framed. Each shows only when the club set that link;
// with neither, nothing is drawn. Used on the finished match page and on the Result page.
const linkSx = { ...compactButtonSx, color: HUB.gold, borderColor: HUB.gold, bgcolor: 'transparent', borderRadius: '4px', whiteSpace: 'nowrap', minHeight: { xs: 44, sm: 32 }, '&:hover': { borderColor: HUB.gold, bgcolor: HUB.lineSoft }, '&:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } } as const

export function HubMatchLinks({ stream, liveScore }: { stream?: MyMatchStreamDto | null; liveScore?: LiveScoreSource | null }) {
  const streamUrl = stream && isHttps(stream.url) ? stream.url : null
  const scoreUrl = liveScore && liveScore.kind === 'EXTERNAL' && isHttps(liveScore.url) ? liveScore.url : null
  if (!streamUrl && !scoreUrl) return null
  return (
    <Box data-testid="match-links" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {streamUrl && (
        <MuiButton variant="outlined" size="small" component="a" href={streamUrl} target="_blank" rel="noopener noreferrer" data-testid="stream-link" startIcon={<PlayArrowIcon />} aria-label="Watch Stream, opens in a new tab" sx={linkSx}>
          Watch Stream
        </MuiButton>
      )}
      {scoreUrl && (
        <MuiButton variant="outlined" size="small" component="a" href={scoreUrl} target="_blank" rel="noopener noreferrer" data-testid="score-link" startIcon={<ScoreboardOutlinedIcon />} aria-label="Online Scorecard, opens in a new tab" sx={linkSx}>
          Online Scorecard
        </MuiButton>
      )}
    </Box>
  )
}
