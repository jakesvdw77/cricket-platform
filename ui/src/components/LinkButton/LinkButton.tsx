import { Button } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'

export interface LinkButtonProps {
  onClick: () => void
  // Defaults to "Link to player".
  ariaLabel?: string
  disabled?: boolean
  sx?: object
  // Lets a page find this button (for example the import wizard's data-guess-key).
  'data-guess-key'?: string
}

// A compact Link control that sits on the line of a name: about 24 px high, with the 44 px touch target kept on a phone by
// an invisible extension of the hit area (the GuessChip technique). Used beside a guest's name to link it to a player.
export function LinkButton({ onClick, ariaLabel = 'Link to player', disabled = false, sx, 'data-guess-key': guessKey }: LinkButtonProps) {
  return (
    <Button
      size="small"
      variant="text"
      aria-label={ariaLabel}
      disabled={disabled}
      data-guess-key={guessKey}
      startIcon={<LinkIcon sx={{ fontSize: '0.95rem' }} />}
      onClick={onClick}
      sx={{
        position: 'relative',
        flex: 'none',
        minWidth: 0,
        minHeight: 24,
        py: 0,
        px: 0.75,
        fontSize: '0.75rem',
        lineHeight: 1.5,
        textTransform: 'none',
        '& .MuiButton-startIcon': { mr: 0.25, ml: 0 },
        '&::after': { content: '""', position: 'absolute', top: { xs: -10, sm: -4 }, bottom: { xs: -10, sm: -4 }, left: -4, right: -4 },
        ...sx,
      }}
    >
      Link
    </Button>
  )
}
