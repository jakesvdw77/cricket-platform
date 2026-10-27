import { Avatar, Box, Typography } from '@mui/material'
import type { MyPlayer } from '../../../api/myPlayersApi'
import { HUB } from './hubStyle'
import { GOLD_DISC_GRADIENT } from '../../../brandTokens'

// docs/specs/121: the selected player's card, the first element of the menu column (60 px avatar on a phone, 64 px from
// sm): name, then club and group, right aligned like the menu bars.
type CardPlayer = Pick<MyPlayer, 'firstName' | 'lastName' | 'photoUrl' | 'clubName' | 'groupLabel'>

export function HubPlayerCard({ player }: { player: CardPlayer }) {
  return (
    <Box data-testid="hub-player-card" sx={{ display: 'flex', gap: 1.75, alignItems: 'center', justifyContent: 'flex-end', textAlign: 'right', px: { xs: 2.25, md: 2.75 }, pt: { xs: 2.25, md: 2.75 }, pb: { xs: 2, md: 2.25 } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 24, lineHeight: 1, letterSpacing: '0.02em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
          {player.firstName} {player.lastName}
        </Typography>
        <Typography fontSize={14} sx={{ color: HUB.muted, mt: 0.5 }}>
          {[player.clubName, player.groupLabel].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <Avatar
        src={player.photoUrl ?? undefined}
        alt=""
        sx={{ width: { xs: 60, sm: 64 }, height: { xs: 60, sm: 64 }, flex: 'none', border: `3px solid ${HUB.cream}`, fontFamily: HUB.display, fontWeight: 700, fontSize: 24, letterSpacing: '.04em', color: HUB.ink, background: GOLD_DISC_GRADIENT }}
      >
        {`${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`.toUpperCase()}
      </Avatar>
    </Box>
  )
}
