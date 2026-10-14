import { Box, ButtonBase } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'

export interface ResultStep {
  id: string
  label: string
  // Shorter label for a phone, when the full one would not fit.
  shortLabel?: string
  // docs/specs/101: a step the result can be published without (the scorecard steps). Drawn with a dashed outline.
  optional?: boolean
}

export interface ResultStepperProps {
  // The registered steps in order; later slices (101, 102) add entries, the stepper itself does not change.
  steps: ResultStep[]
  activeId: string
  onSelect: (id: string) => void
  disabled?: boolean
}

// docs/specs/100-match-results-core.md: the capture wizard's progress strip, data-driven from a list of steps (the short
// labels show on a desktop strip too, so eight steps fit; the full label is the accessible name). Steps
// before the active one show a tick; every step can be chosen (the page saves the draft on the way). docs/specs/101:
// optional steps (Teams and the scorecard) have a dashed outline and a legend under the strip, so a manager sees they can skip them.
export function ResultStepper({ steps, activeId, onSelect, disabled = false }: ResultStepperProps) {
  const activeIndex = steps.findIndex((step) => step.id === activeId)
  const anyOptional = steps.some((step) => step.optional)
  return (
    <Box>
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
              aria-label={`Step ${index + 1}: ${step.label}${step.optional ? ' (optional)' : ''}${done ? ' (done)' : ''}`}
              sx={(theme) => ({
                width: '100%',
                minHeight: 44,
                gap: 0.75,
                px: 0.5,
                borderRadius: 1,
                fontSize: '0.78rem',
                fontWeight: 600,
                border: step.optional && !active ? `1px dashed ${theme.palette.text.secondary}` : '1px solid transparent',
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
                  bgcolor: active ? 'background.paper' : done ? 'primary.main' : theme.palette.text.secondary,
                  color: active ? 'primary.main' : 'common.white',
                })}
              >
                {done ? <CheckIcon sx={{ fontSize: 14 }} /> : index + 1}
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, whiteSpace: 'nowrap' }}>
                {step.shortLabel ?? step.label}
              </Box>
              <Box component="span" sx={{ display: { xs: active ? 'inline' : 'none', sm: 'none' }, whiteSpace: 'nowrap' }}>
                {step.shortLabel ?? step.label}
              </Box>
            </ButtonBase>
          </Box>
        )
      })}
    </Box>
    {anyOptional && (
      <Box component="p" sx={{ m: 0, mt: 0.75, fontSize: '0.75rem', color: 'text.secondary' }}>
        Optional: the dashed steps can be skipped.
      </Box>
    )}
    </Box>
  )
}
