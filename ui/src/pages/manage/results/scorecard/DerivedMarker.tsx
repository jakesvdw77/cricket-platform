import { Box, ButtonBase, Typography } from '@mui/material'

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

// docs/specs/101-match-results-our-side-scorecard.md (Bowling and fielding, "from dismissals"): the caption under a bowler's
// W or a fielder's counters. A figure that follows the dismissals says so; a typed one that disagrees with the dismissals
// offers "Use N" to hand it back. Nothing is shown for a typed figure that already agrees.
export function DerivedMarker({ derived, dismissalsSay, current, onUse, subject, disabled = false }: DerivedMarkerProps) {
  if (derived) {
    return (
      <Typography component="span" sx={{ display: 'block', fontSize: '0.625rem', lineHeight: 1.2, color: 'text.secondary', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
        from dismissals
      </Typography>
    )
  }
  if (dismissalsSay === null || dismissalsSay === current) return null
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <Typography component="span" sx={{ fontSize: '0.625rem', lineHeight: 1.2, color: 'text.secondary', whiteSpace: 'nowrap' }}>
        dismissals say {dismissalsSay}
      </Typography>
      <ButtonBase
        disabled={disabled}
        onClick={onUse}
        aria-label={`Use ${dismissalsSay}, ${subject}`}
        sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'primary.main', textDecoration: 'underline', minHeight: { xs: 32, sm: 0 }, px: 0.25 }}
      >
        Use {dismissalsSay}
      </ButtonBase>
    </Box>
  )
}
