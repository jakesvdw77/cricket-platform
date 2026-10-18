import { ToggleButton, Typography } from '@mui/material'
import { CompactToggleGroup } from '../CompactToggleGroup'
import type { TeamsChoice, TeamsChoiceDisabledReason } from '../../utils/share/shareResultData'

const REASONS: Record<Exclude<TeamsChoiceDisabledReason, null>, string> = {
  DERBY: 'Both teams are ours',
  NO_SCORECARD: 'No scorecard recorded',
}

export interface ShareTeamsControlProps {
  // The choice in force (the model's: 'both' whenever the control is disabled).
  value: TeamsChoice
  disabledReason: TeamsChoiceDisabledReason
  onChange: (next: TeamsChoice) => void
}

// docs/specs/114-share-result.md (What "Our team only" means): Both teams or Our team only, disabled with its reason
// shown as text. Internal to ShareResultDialog.
export function ShareTeamsControl({ value, disabledReason, onChange }: ShareTeamsControlProps) {
  const reasonId = 'share-teams-reason'
  const disabled = disabledReason !== null
  return (
    <>
      <CompactToggleGroup value={value} onChange={onChange} ariaLabel="Teams" fullWidthOnPhone>
        <ToggleButton value="both" disabled={disabled} aria-describedby={disabled ? reasonId : undefined}>
          Both teams
        </ToggleButton>
        <ToggleButton value="ours" disabled={disabled} aria-describedby={disabled ? reasonId : undefined}>
          Our team only
        </ToggleButton>
      </CompactToggleGroup>
      {disabledReason && (
        <Typography id={reasonId} variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {REASONS[disabledReason]}
        </Typography>
      )}
    </>
  )
}
