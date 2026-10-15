import { Button } from '../../../../components/Button'
import type { GuessInfo } from './guessSummary'

// docs/specs/104-match-results-import-adaptors.md: the one-tap "Change to Henk Smit" under an unresolved (Guest) name that the
// resolve step ranked a closest player for. Only the manager's tap links the row (never automatic); the rest of the
// suggestions stay behind the Guest chip's picker. The label truncates, the accessible name carries the full player.
export function UseClosestButton({ guess, disabled = false }: { guess: GuessInfo; disabled?: boolean }) {
  if (!guess.onUseClosest || !guess.closest) return null
  const name = guess.closest.displayName
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={disabled}
      onClick={guess.onUseClosest}
      aria-label={`Change to ${name} for ${guess.importedName}`}
      data-testid="use-closest"
      sx={{
        minHeight: { xs: 44, sm: 28 },
        maxWidth: '100%',
        minWidth: 0,
        justifyContent: 'flex-start',
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.75rem',
        '& .use-closest-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      }}
    >
      <span className="use-closest-label">Change to {name}</span>
    </Button>
  )
}
