import { Box, Tooltip } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/Button'
import {
  importScheduleDisabledReason,
  leagueScheduleImportPath,
} from '../../../utils/leagueScheduleImport'
import type { LeagueScheduleOrigin } from '../../../utils/leagueScheduleImport'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'

export interface ImportScheduleControlProps {
  clubId: string
  leagueId: string
  // The selected season; empty when the club has none.
  seasonId: string
  leagueActive?: boolean
  // Which Schedule the manager is on, so the wizard's Back returns to it.
  from: LeagueScheduleOrigin
  // docs/specs/127: the name of the page the button is on, for the wizard's "Back to ..." (the wizard returns to this page).
  originLabel?: string
}

// docs/specs/098-league-schedule-import.md, "Entry points and routes": the outlined Import schedule button. Disabled, with the
// reason as a tooltip, when there is no season or the league is inactive.
export function ImportScheduleButton({ leagueId, seasonId, leagueActive = true, from, originLabel }: Omit<ImportScheduleControlProps, 'clubId'>) {
  const navigate = useNavigate()
  const location = useLocation()
  const reason = importScheduleDisabledReason({ hasSeason: Boolean(seasonId), leagueActive })
  return (
    <Tooltip title={reason ?? ''} disableHoverListener={!reason} disableFocusListener={!reason} disableTouchListener={!reason}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <Button size="compact" variant="secondary" disabled={Boolean(reason)} onClick={() => navigate(withReturnTo(leagueScheduleImportPath(leagueId, seasonId, from), currentOrigin(location), originLabel))}>
          Import Schedule
        </Button>
      </Box>
    </Tooltip>
  )
}
