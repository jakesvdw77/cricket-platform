import { Box, Checkbox, Chip, FormControlLabel, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import { Button } from '../../../../components/Button'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { ResultScoreLine } from '../../../../components/ResultScoreLine'
import { badgeSx } from '../../../../components/RecordCard'
import type { ResultValidation } from '../../../../api/matchResultApi'
import type { MarginCheck } from '../../../../utils/marginCheck'
import { inningsFor, resultLine } from '../../../../utils/resultLine'
import { formatMatchDateTime } from '../../../../utils/matchDateTime'
import { tossLine } from '../resultListHelpers'
import { toPayload } from '../resultDraftHelpers'
import type { StepProps } from './stepTypes'

export interface ReviewStepProps extends StepProps {
  check: MarginCheck
  needsAck: boolean
  onFix: () => void
  validation: ResultValidation | null
  validating: boolean
  validationFailed: boolean
  warningsAcknowledged: boolean
  onAcknowledgeChange: (acknowledged: boolean) => void
  fieldName: string | null
}

function Notice({ tone, lines }: { tone: 'error' | 'warning'; lines: string[] }) {
  const color = tone === 'error' ? 'error' : 'warning'
  return (
    <Box
      role={tone === 'error' ? 'alert' : undefined}
      sx={(theme) => ({
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        borderRadius: 1,
        border: 1,
        borderColor: alpha(theme.palette[color].main, 0.4),
        bgcolor: alpha(theme.palette[color].main, 0.08),
        px: 1.5,
        py: 1.25,
      })}
    >
      {tone === 'error' ? <ErrorOutlineIcon color="error" fontSize="small" /> : <WarningAmberOutlinedIcon color="warning" fontSize="small" />}
      <Box component="ul" sx={{ m: 0, pl: 2, flex: 1 }}>
        {lines.map((line) => (
          <Typography key={line} component="li" variant="body2">
            {line}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

// The server already words some of what the scores check says (margin against scores, wrong batting side for the margin).
// When the client check has its own finding for those, the server's version is dropped so each problem is listed once.
const MARGIN_WARNING_PATTERNS = [
  /^The scores differ by \d+ runs, but the margin is/,
  / lost \d+ wickets, but the margin is/,
  / won by (runs but batted second|wickets but batted first)\.$/,
  /^The match is recorded as a tie but the two innings are not level\.$/,
  / scored more, but .* is marked as the winner\.$/,
  /^The scores are level\. Was it a tie/,
  / scored more in the super over, but /,
  /^The super over is level too/,
  / won chasing a DLS target of /,
  / reached the DLS target of /,
]

function dedupeWarnings(warnings: string[], check: MarginCheck): string[] {
  if (check.status !== 'mismatch') return warnings
  return warnings.filter((line) => !MARGIN_WARNING_PATTERNS.some((pattern) => pattern.test(line)))
}

function CheckRow({ tone, text, action }: { tone: 'ok' | 'warning' | 'error' | 'info'; text: string; action?: import('react').ReactNode }) {
  const icon =
    tone === 'ok' ? <CheckCircleOutlineIcon color="success" fontSize="small" />
    : tone === 'error' ? <ErrorOutlineIcon color="error" fontSize="small" />
    : tone === 'warning' ? <WarningAmberOutlinedIcon color="warning" fontSize="small" />
    : <InfoOutlinedIcon color="disabled" fontSize="small" />
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 0.75, listStyle: 'none' }} data-tone={tone}>
      <Box sx={{ display: 'flex', pt: 0.1 }}>{icon}</Box>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
        {text}
      </Typography>
      {action}
    </Box>
  )
}

// docs/specs/100-match-results-core.md, step 4 "Review and publish": the result exactly as the card shows it, then the
// server's validation - errors block publishing, warnings need a tick. The Publish button lives in the page's footer.
export function ReviewStep({ match, draft, sides, check, needsAck, onFix, validation, validating, validationFailed, warningsAcknowledged, onAcknowledgeChange, fieldName }: ReviewStepProps) {
  const payload = toPayload(draft)
  const names = { home: sides[0].name, away: sides[1].name }
  const toss = tossLine({ tossWonBy: payload.tossWonBy ?? null, tossDecision: payload.tossDecision ?? null }, names)
  const line = resultLine(
    {
      outcomeType: payload.outcomeType ?? null,
      decidedBy: payload.decidedBy ?? 'REGULAR',
      winningSide: payload.winningSide ?? null,
      marginType: payload.marginType ?? null,
      marginValue: payload.marginValue ?? null,
    },
    names,
  )
  const ballsPerOver = payload.ballsPerOver ?? 6

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormSectionHeading icon={<FactCheckOutlinedIcon />} title="This is how the result will look" />
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.75, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: 'background.paper' }} data-testid="result-preview">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Chip size="small" label="Draft" sx={{ ...badgeSx('warning'), height: 22, fontSize: '0.75rem' }} />
        </Box>
        {sides.map((side) => {
          const winner = payload.outcomeType === 'WON' && payload.winningSide === side.side
          return (
            <Box key={side.side} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography variant="body1" fontWeight={winner ? 700 : 600} noWrap sx={{ flex: 1, minWidth: 0 }}>
                {side.name}
              </Typography>
              <ResultScoreLine innings={inningsFor(payload.innings ?? [], side.side)} ballsPerOver={ballsPerOver} winner={winner} />
            </Box>
          )
        })}
        <Typography variant="body2" fontWeight={700} sx={{ borderTop: 1, borderColor: 'divider', pt: 1, color: 'primary.dark' }}>
          {line}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {[toss, formatMatchDateTime(match.matchDate), fieldName].filter(Boolean).join(' · ')}
        </Typography>
      </Box>

      <Box aria-live="polite" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <FormSectionHeading icon={<FactCheckOutlinedIcon />} title="Checks" />
        {validating && (
          <Typography variant="body2" color="text.secondary">
            Checking the result…
          </Typography>
        )}
        {validationFailed && <Notice tone="error" lines={["We couldn't check the result. Please try again."]} />}
        {validation && (
          <Box component="ul" aria-label="Checks" sx={{ m: 0, p: 0 }}>
            {validation.errors.map((line) => (
              <CheckRow key={`e-${line}`} tone="error" text={line} />
            ))}
            {check.status === 'mismatch' && (
              <CheckRow
                tone="warning"
                text={check.reason}
                action={
                  check.suggestion ? (
                    <Button variant="secondary" size="sm" onClick={onFix}>
                      Fix
                    </Button>
                  ) : undefined
                }
              />
            )}
            {check.status === 'match' && <CheckRow tone="ok" text={check.reason} />}
            {check.status === 'cannot-check' && <CheckRow tone="info" text={check.reason} />}
            {dedupeWarnings(validation.warnings, check).map((line) => (
              <CheckRow key={`w-${line}`} tone="warning" text={line} />
            ))}
            {validation.errors.length === 0 && validation.warnings.length === 0 && check.status !== 'mismatch' && (
              <CheckRow tone="ok" text="Everything checks out. This result is ready to publish." />
            )}
          </Box>
        )}
        {validation && validation.errors.length === 0 && needsAck && (
          <FormControlLabel
            control={<Checkbox checked={warningsAcknowledged} onChange={(event) => onAcknowledgeChange(event.target.checked)} />}
            label="I have checked these warnings and want to publish anyway"
            sx={{ minHeight: 44, alignItems: 'center' }}
          />
        )}
      </Box>
    </Box>
  )
}
