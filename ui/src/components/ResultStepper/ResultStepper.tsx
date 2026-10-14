import { Box, ButtonBase } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'

export interface ResultStep {
  id: string
  label: string
  // Shorter label for a phone, when the full one would not fit.
  shortLabel?: string
}

export interface ResultStepperProps {
  // The registered steps in order; later slices (101, 102) add entries, the stepper itself does not change.
  steps: ResultStep[]
  activeId: string
  onSelect: (id: string) => void
  disabled?: boolean
}

// docs/specs/100-match-results-core.md: the capture wizard's progress strip, data-driven from a list of steps. Steps
// before the active one show a tick; every step can be chosen (the page saves the draft on the way).
export function ResultStepper({ steps, activeId, onSelect, disabled = false }: ResultStepperProps) {
  const activeIndex = steps.findIndex((step) => step.id === activeId)
  return (
    <Box component="ol" aria-label="Steps" sx={{ display: 'flex', gap: 0.75, listStyle: 'none', m: 0, p: 0 }}>
      {steps.map((step, index) => {
        const active = index === activeIndex
        const done = index < activeIndex
        return (
          <Box component="li" key={step.id} sx={{ flex: 1, minWidth: 0 }}>
            <ButtonBase
              disabled={disabled}
              onClick={() => onSelect(step.id)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${index + 1}: ${step.label}${done ? ' (done)' : ''}`}
              sx={(theme) => ({
                width: '100%',
                minHeight: 44,
                gap: 0.75,
                px: 0.5,
                borderRadius: 1,
                fontSize: '0.78rem',
                fontWeight: 600,
                bgcolor: active ? 'primary.main' : alpha(theme.palette.primary.main, 0.08),
                color: active ? 'primary.contrastText' : 'text.secondary',
                '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.dark}`, outlineOffset: 2 },
              })}
            >
              <Box
                aria-hidden
                component="span"
                sx={(theme) => ({
                  width: 20,
                  height: 20,
                  flex: 'none',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  bgcolor: active ? 'background.paper' : done ? 'primary.main' : theme.palette.grey[400],
                  color: active ? 'primary.main' : 'common.white',
                })}
              >
                {done ? <CheckIcon sx={{ fontSize: 14 }} /> : index + 1}
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, whiteSpace: 'nowrap' }}>
                {step.label}
              </Box>
              <Box component="span" sx={{ display: { xs: active ? 'inline' : 'none', sm: 'none' }, whiteSpace: 'nowrap' }}>
                {step.shortLabel ?? step.label}
              </Box>
            </ButtonBase>
          </Box>
        )
      })}
    </Box>
  )
}
