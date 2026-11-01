import { Box, Button as MuiButton, Typography } from '@mui/material'
import { compactButtonSx } from '../../../components/Button'
import type { LiveScoreSource } from '../../../api/myPlayersApi'
import { blackAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { LeagueLogo } from './HubLeagueCard'
import { isHttps } from './leagueFormat'

// docs/specs/135 (The LiveScore seam): the ONE place that knows what a live-score source is. Today only EXTERNAL exists: a Follow Live
// Score button opening the club's scoring site in a new tab (noopener, https only, never framed). A native in-app scorecard later is a
// new `kind` handled here, with no change to the Live Now row, the match page or the Watch Live page that place this component.
//   row  - the button alone, inside a Live Now card;
//   card - the match page's flat panel with the club's name and logo;
//   tv   - the Watch Live page's panel, directly under the frame.
export type LiveScoreVariant = 'row' | 'card' | 'tv'

export interface HubLiveScoreProps {
  source: LiveScoreSource | null | undefined
  variant: LiveScoreVariant
  // The card variant's heading: the club (or own team) name and logo.
  owner?: { name: string; logoUrl?: string | null }
}

const followSx = { ...compactButtonSx, color: HUB.gold, borderColor: HUB.gold, bgcolor: 'transparent', borderRadius: '4px', '&:hover': { borderColor: HUB.gold, bgcolor: HUB.lineSoft }, '&:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } } as const

function FollowButton({ source }: { source: LiveScoreSource }) {
  return (
    <MuiButton
      variant="outlined"
      size="small"
      component="a"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="follow-live-score"
      sx={{ ...followSx, position: 'relative', zIndex: 1, alignSelf: 'flex-start' }}
    >
      Follow Live Score
    </MuiButton>
  )
}

export function HubLiveScore({ source, variant, owner }: HubLiveScoreProps) {
  if (!source || source.kind !== 'EXTERNAL' || !isHttps(source.url)) return null
  if (variant === 'row') return <FollowButton source={source} />
  const note = variant === 'card' ? `Scores are kept on ${source.host}. It opens in a new tab.` : `Scores are kept on ${source.host}.`
  return (
    <Box
      data-testid={`live-score-${variant}`}
      sx={{ display: 'grid', gap: 0.75, border: 1, borderColor: HUB.line, borderLeft: variant === 'tv' ? `4px solid ${HUB.gold}` : undefined, borderRadius: '4px', p: 1.5, bgcolor: blackAlpha(0.22) }}
    >
      {variant === 'card' && owner && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <LeagueLogo logoUrl={owner.logoUrl ?? null} size={28} />
          <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 21, overflowWrap: 'anywhere' }}>{owner.name}</Typography>
        </Box>
      )}
      <Typography sx={{ fontSize: 14, color: HUB.muted }}>{note}</Typography>
      <FollowButton source={source} />
    </Box>
  )
}
