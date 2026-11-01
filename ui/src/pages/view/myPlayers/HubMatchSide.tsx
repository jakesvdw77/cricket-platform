import { Box, Chip, Typography } from '@mui/material'
import type { MyMatchSideDto } from '../../../api/myPlayersApi'
import { blackAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { LeagueLogo } from './HubLeagueCard'

// docs/specs/135 (Match page, Teams): one flat hairline panel per side. The announced XI only (the server sends an empty list for a
// side that is not announced); juniors already arrive as initials. "(C)" captain, "(WK)" keeper, "(12th)" twelfth man.
export function HubMatchSide({ side }: { side: MyMatchSideDto }) {
  return (
    <Box data-testid="match-side" data-mine={side.mine ? 'true' : undefined} component="section" aria-label={side.name} sx={{ display: 'grid', gap: 0.75, border: 1, borderColor: HUB.line, borderRadius: '4px', p: 1.5, bgcolor: blackAlpha(0.22) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <LeagueLogo logoUrl={side.logoUrl ?? null} size={28} />
        <Typography component="h3" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 21, overflowWrap: 'anywhere' }}>{side.name}</Typography>
        {side.mine && <Chip size="small" variant="outlined" label="Your team" sx={{ height: 22, borderRadius: '4px', fontSize: 12, fontWeight: 600, color: HUB.gold, borderColor: HUB.gold, bgcolor: 'transparent' }} />}
      </Box>
      {side.announced && side.players.length > 0 ? (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, fontSize: 15, lineHeight: 1.5 }}>
          {side.players.map((player, index) => (
            <li key={`${index}-${player.name}`} data-testid="match-player">
              <Box component="span" sx={{ color: HUB.muted, display: 'inline-block', minWidth: 24 }}>{player.twelfth ? '' : index + 1}</Box>
              {player.name}
              {player.captain ? ' (C)' : ''}
              {player.keeper ? ' (WK)' : ''}
              {player.twelfth ? ' (12th)' : ''}
            </li>
          ))}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 14, color: HUB.muted }}>Team not announced yet</Typography>
      )}
    </Box>
  )
}
