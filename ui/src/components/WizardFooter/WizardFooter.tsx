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
  // true: the note sits in the button row beside the buttons (from md up) instead of in a caption row under it.
  inlineNote?: boolean
}

// docs/standards/design-system.md, "Wizard footer": one bottom row for every wizard step. Back (filled, like Next) on the left;
// Save draft (outlined) then Next (filled) on the right. On a phone it stacks full width: Next, Back, then Save draft. compact buttons (the 44 px touch area is kept by the compact size).
export function WizardFooter({ back, secondary, primary, note, inlineNote = false }: WizardFooterProps) {
  const target = { width: { xs: '100%', md: 'auto' }, minWidth: { md: 110 } }
  const noteSx = { textAlign: { xs: 'center', md: 'right' } }
  return (
    <Box data-testid="wizard-footer" sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, gap: 1.25 }}>
        {back && (
          <Button size="compact" onClick={back.onClick} disabled={back.disabled} sx={{ ...target, mr: { md: 'auto' }, order: { xs: 2, md: 0 } }}>
            {back.label}
          </Button>
        )}
        {inlineNote && note && (
          <Typography variant="caption" color="text.secondary" sx={{ ...noteSx, order: { xs: 4, md: 1 }, ml: { md: back ? 0 : 'auto' } }}>
            {note}
          </Typography>
        )}
        {secondary && (
          <Button size="compact" variant="secondary" onClick={secondary.onClick} disabled={secondary.disabled} sx={{ ...target, ml: { md: back || (inlineNote && note) ? 0 : 'auto' }, order: { xs: 3, md: 2 } }}>
            {secondary.label}
          </Button>
        )}
        {primary && (
          <Button size="compact" onClick={primary.onClick} disabled={primary.disabled} sx={{ ...target, ml: { md: back || secondary || (inlineNote && note) ? 0 : 'auto' }, order: { xs: 1, md: 3 } }}>
            {primary.label}
          </Button>
        )}
      </Box>
      {note && !inlineNote && (
        <Typography variant="caption" color="text.secondary" sx={noteSx}>
          {note}
        </Typography>
      )}
    </Box>
  )
}
