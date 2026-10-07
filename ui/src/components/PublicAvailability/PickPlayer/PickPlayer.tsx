import { Box, ButtonBase, Typography } from '@mui/material'
import { Button } from '../../Button'
import type { PickCandidate } from '../../../api/publicAvailabilityShared'

export interface PickPlayerProps {
  firstName: string
  lastName: string
  candidates: PickCandidate[]
  onPick: (playerId: string) => void
  onBack?: () => void
  disabled?: boolean
}

function describe(candidate: PickCandidate): string {
  return [candidate.shirtNumber != null ? `#${candidate.shirtNumber}` : null, candidate.teamLabel].filter(Boolean).join(' · ')
}

// docs/specs/077: the rare case where the name and the date of birth match more than one player.
// Only the shirt number and team are shown, nothing else about either player.
export function PickPlayer({ firstName, lastName, candidates, onPick, onBack, disabled = false }: PickPlayerProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="h6" component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>
        Which one are you?
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Two players match. Pick yourself.
      </Typography>
      {candidates.map((candidate) => (
        <ButtonBase
          key={candidate.playerId}
          disabled={disabled}
          onClick={() => onPick(candidate.playerId)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            bgcolor: 'background.paper',
            borderRadius: 1,
            boxShadow: 1,
            px: 1.5,
            py: 1.25,
            minHeight: 48,
            width: '100%',
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            {firstName} {lastName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {describe(candidate) || 'No shirt number or team'}
          </Typography>
        </ButtonBase>
      ))}
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} sx={{ alignSelf: 'flex-start' }}>
          Back
        </Button>
      )}
    </Box>
  )
}
