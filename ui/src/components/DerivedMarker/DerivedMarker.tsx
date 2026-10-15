import { ButtonBase } from '@mui/material'

export interface DerivedMarkerProps {
  // DERIVED: the figure follows the dismissals. MANUAL: it was typed.
  derived: boolean
  // What the dismissals credit, or null while the dismissals say nothing useful.
  dismissalsSay: number | null
  // The typed figure; "Use N" is offered only where it differs from what the dismissals say.
  current: number
  onUse: () => void
  // Names the action for assistive technology ("Use 2, wickets of A. Smith").
  subject: string
  disabled?: boolean
}

// docs/specs/101-match-results-our-side-scorecard.md (Bowling and fielding): the compact "Use N" under a bowler's W when the
// typed figure disagrees with what the dismissals credit. Nothing is shown when the figure follows the dismissals or agrees.
export function DerivedMarker({ derived, dismissalsSay, current, onUse, subject, disabled = false }: DerivedMarkerProps) {
  // A figure that follows the dismissals needs no label, and neither does a typed one that agrees with them.
  if (derived || dismissalsSay === null || dismissalsSay === current) return null
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onUse}
      aria-label={`Use ${dismissalsSay}, ${subject}`}
      title={`The dismissals say ${dismissalsSay}`}
      sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'primary.main', textDecoration: 'underline', minHeight: { xs: 32, sm: 0 }, px: 0.25 }}
    >
      Use {dismissalsSay}
    </ButtonBase>
  )
}
