import { Box, Chip, Tooltip } from '@mui/material'
import type { ImportCheckSettingsState } from '../../../components/ImportWizard'
import { Button } from '../../../components/Button'

// docs/specs/098-league-schedule-import.md, amendment 2026-10-30: DATE_OUTSIDE_LEAGUE_DATES is not a dead end. Extending the league
// dates is a decision (options.extendLeagueDates), saved in one update; nothing is written to the league until Confirm.
export const DATE_OUTSIDE_LEAGUE_DATES = 'DATE_OUTSIDE_LEAGUE_DATES'
export const EXTEND_LEAGUE_DATES_OPTION = 'extendLeagueDates'

export function ExtendLeagueDatesControl({ decisions, issues, setOptions, disabled }: ImportCheckSettingsState) {
  const touch = { minHeight: { xs: 44, md: 32 } }
  if (decisions.options?.[EXTEND_LEAGUE_DATES_OPTION] === true) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Chip size="small" label="League dates will be extended" />
        <Button size="compact" variant="ghost" disabled={disabled} onClick={() => setOptions({ [EXTEND_LEAGUE_DATES_OPTION]: false })} sx={touch}>
          Undo
        </Button>
      </Box>
    )
  }
  if (!issues.some((issue) => issue.code === DATE_OUTSIDE_LEAGUE_DATES)) return null
  return (
    <Tooltip title="Widen this league's start and end dates so these matches fit. You confirm the change on the next step.">
      <span>
        <Button size="compact" variant="ghost" disabled={disabled} onClick={() => setOptions({ [EXTEND_LEAGUE_DATES_OPTION]: true })} sx={touch}>
          Extend league dates
        </Button>
      </span>
    </Tooltip>
  )
}
