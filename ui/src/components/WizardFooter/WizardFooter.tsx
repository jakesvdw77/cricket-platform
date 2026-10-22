import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { Button } from '../Button'

export interface WizardFooterAction {
  label: ReactNode
  onClick: () => void
  disabled?: boolean
}

export interface WizardFooterProps {
  // Left, filled like the primary.
  back?: WizardFooterAction
  // Right, outlined (Save draft).
  secondary?: WizardFooterAction
  // Right, filled (Next: <step>, Publish, Continue).
  primary?: WizardFooterAction
  // A small caption under the row (e.g. "Nothing is saved at this step.").
  note?: ReactNode
}

// docs/standards/design-system.md, "Wizard footer": one bottom row for every wizard step. Back (filled, like Next) on the left;
// Save draft (outlined) then Next (filled) on the right. On a phone it stacks full width: Next, Back, then Save draft. 44 px targets.
export function WizardFooter({ back, secondary, primary, note }: WizardFooterProps) {
  const target = { minHeight: 44, width: { xs: '100%', md: 'auto' }, minWidth: { md: 110 } }
  return (
    <Box data-testid="wizard-footer" sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, gap: 1.25 }}>
        {back && (
          <Button onClick={back.onClick} disabled={back.disabled} sx={{ ...target, mr: { md: 'auto' }, order: { xs: 2, md: 0 } }}>
            {back.label}
          </Button>
        )}
        {secondary && (
          <Button variant="secondary" onClick={secondary.onClick} disabled={secondary.disabled} sx={{ ...target, ml: { md: back ? 0 : 'auto' }, order: { xs: 3, md: 1 } }}>
            {secondary.label}
          </Button>
        )}
        {primary && (
          <Button onClick={primary.onClick} disabled={primary.disabled} sx={{ ...target, ml: { md: back || secondary ? 0 : 'auto' }, order: { xs: 1, md: 2 } }}>
            {primary.label}
          </Button>
        )}
      </Box>
      {note && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'center', md: 'right' } }}>
          {note}
        </Typography>
      )}
    </Box>
  )
}
