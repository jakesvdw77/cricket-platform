import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined'
import { Button } from '../../../../components/Button'
import type { MarginCheck, SideNames } from '../../../../utils/marginCheck'
import { suggestionText } from '../../../../utils/marginCheck'

export interface SuggestedResultLineProps {
  check: MarginCheck
  names: SideNames
  onUse: () => void
  // False when only the margin differs: that follows the scores (or is the manager's edit) and needs no button.
  canUse?: boolean
  disabled?: boolean
}

// docs/specs/100-match-results-core.md: "Suggested result" - what the entered scores say, with a Use this action that
// writes outcome, winner and margin into the form. Hidden until both innings are in; once the form agrees it reads as a
// quiet confirmation instead of offering the action.
export function SuggestedResultLine({ check, names, onUse, canUse = true, disabled }: SuggestedResultLineProps) {
  if (!check.suggestion) return null
  const agrees = check.status === 'match'
  return (
    <Box
      data-testid="suggested-result"
      sx={(theme) => ({ borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.08), p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' })}
    >
      <AutoFixHighOutlinedIcon fontSize="small" color="primary" aria-hidden />
      <Box sx={{ flex: 1, minWidth: 180 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Suggested result
        </Typography>
        <Typography variant="body2" fontWeight={700} sx={{ color: 'primary.dark' }}>
          {suggestionText(check.suggestion, names)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {agrees ? 'Matches the result you entered' : 'Worked out from the scores; change it if the scorecard says otherwise'}
        </Typography>
      </Box>
      {!agrees && canUse && (
        <Button variant="secondary" size="sm" onClick={onUse} disabled={disabled}>
          Use this
        </Button>
      )}
    </Box>
  )
}
