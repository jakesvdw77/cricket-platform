import { Box } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { Button } from '../../../components/Button'
import type { LiveScoreSource, MyMatchStreamDto } from '../../../api/myPlayersApi'
import { hubGoldOutlineButton } from './hubStyle'
import { HubLiveScore } from './HubLiveScore'
import { isHttps } from './leagueFormat'

// Owner, 2026-11-12: a finished match keeps its links. Watch Stream (the recording, where the club kept the stream link) and Online
// Scorecard (the club's scoring site, through HubLiveScore, the only place that reads a score source) open in a new tab, https only, never
// framed. Each shows only when the club set that link; with neither, nothing is drawn. Used on the finished match page and the Result page.
export function HubMatchLinks({ stream, liveScore }: { stream?: MyMatchStreamDto | null; liveScore?: LiveScoreSource | null }) {
  const streamUrl = stream && isHttps(stream.url) ? stream.url : null
  const hasScore = Boolean(liveScore && liveScore.kind === 'EXTERNAL' && isHttps(liveScore.url))
  if (!streamUrl && !hasScore) return null
  return (
    <Box data-testid="match-links" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {streamUrl && (
        <Button variant="secondary" size="compact" component="a" href={streamUrl} target="_blank" rel="noopener noreferrer" data-testid="stream-link" startIcon={<PlayArrowIcon />} aria-label="Watch Stream, opens in a new tab" sx={hubGoldOutlineButton}>
          Watch Stream
        </Button>
      )}
      <HubLiveScore source={liveScore} variant="scorecard" />
    </Box>
  )
}
