import { Box, Button as MuiButton, ButtonBase, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { Button } from '../../Button'
import { formatDateTime } from '../../../utils/publicAvailabilityFormat'
import type { RememberedPlayerView } from '../../../hooks/useRememberedPlayers'

export interface RememberedPlayersProps {
  players: RememberedPlayerView[]
  onSelect: (player: RememberedPlayerView) => void
  onRemove: (player: RememberedPlayerView) => void
  onForgetAll: () => void
  onSomeoneElse: () => void
}

// docs/specs/077: "Welcome back". Tapping a player fills in the name so only the date of birth is
// asked. Names only, kept on this device only; each can be removed and the lot forgotten.
export function RememberedPlayers({ players, onSelect, onRemove, onForgetAll, onSomeoneElse }: RememberedPlayersProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="h6" component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>
        Welcome back
      </Typography>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
        Your players on this device
      </Typography>
      {players.map((player) => {
        const name = `${player.firstName} ${player.lastName}`
        return (
          <Box
            key={name}
            sx={{ display: 'flex', alignItems: 'stretch', bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}
          >
            <ButtonBase
              onClick={() => onSelect(player)}
              sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', px: 1.5, py: 1.25, minHeight: 48 }}
            >
              <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: '100%' }}>
                {name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {player.answeredAt ? `Answered ${formatDateTime(player.answeredAt)}` : 'Not answered yet'}
              </Typography>
            </ButtonBase>
            <IconButton aria-label={`Remove ${name} from this device`} onClick={() => onRemove(player)} sx={{ alignSelf: 'center', mr: 0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )
      })}
      <Button variant="secondary" onClick={onSomeoneElse}>
        Someone else? Enter their details
      </Button>
      <MuiButton size="small" color="inherit" onClick={onForgetAll} sx={{ textTransform: 'none', alignSelf: 'flex-start', color: 'text.secondary' }}>
        Forget this device
      </MuiButton>
    </Box>
  )
}
