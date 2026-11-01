import { Alert, Box, Link, Stack } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { Button } from '../Button'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import type { ScheduleFinding, ScheduleFindings } from '../../api/matchApi'

export interface ScheduleFindingsPanelProps {
  result: ScheduleFindings
  // Shown only when the findings are warnings alone (needsConfirmation). Resends the save with the warning codes.
  onSaveAnyway?: () => void
  // Dismisses the findings and keeps the form as it is.
  onCancel?: () => void
  pending?: boolean
  // Label for the "Back to ..." of a page opened through the Open link.
  returnLabel?: string
}

function OpenLink({ finding, returnLabel }: { finding: ScheduleFinding; returnLabel: string }) {
  const location = useLocation()
  if (!finding.otherMatchId) return null
  const to = withReturnTo(`/manage/fixtures/matches/${finding.otherMatchId}`, currentOrigin(location), returnLabel)
  return (
    <Link component={RouterLink} to={to} underline="always" sx={{ ml: 1, fontWeight: 600 }} data-testid={`finding-open-${finding.code}`}>
      Open
    </Link>
  )
}

// docs/specs/132: the shared scheduling rules' refusal of a match save. Errors block and name the other match with an Open
// link (carrying returnTo); warnings alone form one banner with Save Anyway and Cancel (docs/standards/page-anatomy.md).
export function ScheduleFindingsPanel({ result, onSaveAnyway, onCancel, pending = false, returnLabel = 'Match' }: ScheduleFindingsPanelProps) {
  const errors = result.findings.filter((f) => f.severity === 'ERROR')
  const warnings = result.findings.filter((f) => f.severity === 'WARNING')
  const canConfirm = result.needsConfirmation && errors.length === 0 && warnings.length > 0

  return (
    <Stack spacing={1} data-testid="schedule-findings">
      {errors.map((finding) => (
        <Alert key={`${finding.code}-${finding.otherMatchId ?? ''}`} severity="error" data-testid="schedule-finding-error">
          {finding.message}
          <OpenLink finding={finding} returnLabel={returnLabel} />
        </Alert>
      ))}
      {warnings.length > 0 && (
        <Alert severity="warning" data-testid="schedule-finding-warning" sx={{ alignItems: 'center' }}>
          <Stack spacing={0.5}>
            {warnings.map((finding) => (
              <Box key={`${finding.code}-${finding.otherMatchId ?? ''}`}>
                {finding.message}
                <OpenLink finding={finding} returnLabel={returnLabel} />
              </Box>
            ))}
            {canConfirm && (
              <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
                <Button size="compact" onClick={onSaveAnyway} disabled={pending}>
                  {pending ? 'Saving…' : 'Save Anyway'}
                </Button>
                <Button size="compact" variant="secondary" onClick={onCancel} disabled={pending}>
                  Cancel
                </Button>
              </Stack>
            )}
          </Stack>
        </Alert>
      )}
    </Stack>
  )
}
