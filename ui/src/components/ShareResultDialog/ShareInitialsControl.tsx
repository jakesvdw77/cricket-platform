import { Alert, Typography } from '@mui/material'
import { CompactSwitch } from '../CompactSwitch'
import type { ShareInitialsState } from './useShareInitials'

export interface ShareInitialsControlProps {
  initials: ShareInitialsState
  // The shortened names ("M. Naidoo") that two different players share when first names are initials; empty when none.
  collisions: string[]
  // Called with the new value; a screen wraps it to confirm replacing typed edits first.
  onChange: (next: boolean) => void
}

// docs/specs/114-share-result.md (First names as initials, Default and junior lock): the switch at the top of every format's Include
// group, with its visible lock reason, the collision note and the club default switch. Internal to ShareResultDialog.
export function ShareInitialsControl({ initials, collisions, onChange }: ShareInitialsControlProps) {
  const reasonId = 'share-initials-reason'
  const defaultHelpId = 'share-initials-default-help'
  return (
    <>
      <CompactSwitch
        label="First names as initials"
        checked={initials.value}
        disabled={initials.locked}
        describedBy={initials.locked ? reasonId : undefined}
        onChange={onChange}
      />
      {initials.locked && initials.lockReason && (
        <Typography id={reasonId} variant="caption" color="text.secondary">
          {initials.lockReason}
        </Typography>
      )}
      {initials.value && collisions.length > 0 && (
        <Alert severity="warning" variant="outlined" sx={{ py: 0, fontSize: '0.8rem' }}>
          Two or more players show as {collisions.join(', ')}.
        </Alert>
      )}
      <CompactSwitch
        label="Make this the club default"
        checked={initials.clubDefault}
        disabled={initials.clubDefaultSaving}
        describedBy={initials.locked ? defaultHelpId : undefined}
        onChange={initials.setClubDefault}
      />
      {initials.locked && (
        <Typography id={defaultHelpId} variant="caption" color="text.secondary">
          Does not apply to junior leagues
        </Typography>
      )}
      {initials.clubDefaultFailed && (
        <Typography variant="caption" color="error" role="alert">
          Could not save the club default.
        </Typography>
      )}
    </>
  )
}
