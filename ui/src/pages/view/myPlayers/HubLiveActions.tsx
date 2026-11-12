import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { Link as RouterLink } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { hubGoldButton } from './hubStyle'
import { watchPath } from './matchFormat'

// The live match actions in one place (owner, 2026-11-12): Watch Live (gold) then Live Score (outlined), top right beside the LIVE badge on
// the match page and on a live row. Each shows only when it applies. `score` is the Live Score button (HubLiveScore, the only place that
// knows a score source), handed in because the row reads its source lazily and the match page already has it.
export function HubLiveActions({ playerKey, matchId, from, hasStream, score }: { playerKey: string; matchId: string; from?: string | null; hasStream: boolean; score?: ReactNode }) {
  if (!hasStream && !score) return null
  return (
    <Box data-testid="live-actions" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', position: 'relative', zIndex: 1 }}>
      {hasStream && (
        <Button component={RouterLink} to={watchPath(playerKey, matchId, from)} size="compact" startIcon={<PlayArrowIcon />} data-testid="watch-live" sx={{ ...hubGoldButton, whiteSpace: 'nowrap' }}>
          Watch Live
        </Button>
      )}
      {score}
    </Box>
  )
}
