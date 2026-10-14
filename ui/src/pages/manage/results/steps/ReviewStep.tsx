import type { ReactNode } from 'react'
import { Alert, Box, Checkbox, Chip, FormControlLabel, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import { Button } from '../../../../components/Button'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { DetailLine } from '../../../../components/DetailLine'
import { ResultSummary } from '../../../../components/ResultSummary'
import { badgeSx } from '../../../../components/RecordCard'
import type { ResultValidation } from '../../../../api/matchResultApi'
import type { MarginCheck } from '../../../../utils/marginCheck'
import { inningsFor, resultLine } from '../../../../utils/resultLine'
import { formatMatchDateTime } from '../../../../utils/matchDateTime'
import { tossLine } from '../resultListHelpers'
import { toPayload } from '../resultDraftHelpers'
import { dedupeWarnings } from './dedupeWarnings'
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

function CheckRow({ tone, text, action }: { tone: 'ok' | 'warning' | 'error' | 'info'; text: string; action?: ReactNode }) {
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
        <ResultSummary
          sides={sides.map((side) => ({
            key: side.side,
            name: side.name,
            innings: inningsFor(payload.innings ?? [], side.side),
            winner: payload.outcomeType === 'WON' && payload.winningSide === side.side,
          }))}
          ballsPerOver={ballsPerOver}
          resultLine={line}
        >
          <DetailLine icon={<SportsCricketOutlinedIcon fontSize="small" />} label="Toss" value={toss ?? 'Not recorded'} muted={!toss} />
          <DetailLine icon={<EventOutlinedIcon fontSize="small" />} label="Played" value={formatMatchDateTime(match.matchDate)} />
          <DetailLine icon={<PlaceOutlinedIcon fontSize="small" />} label="Field" value={fieldName ?? 'Not recorded'} muted={!fieldName} />
        </ResultSummary>
      </Box>

      <Box aria-live="polite" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <FormSectionHeading icon={<FactCheckOutlinedIcon />} title="Checks" />
        {validating && (
          <Typography variant="body2" color="text.secondary">
            Checking the result…
          </Typography>
        )}
        {validationFailed && <Alert severity="error">We couldn't check the result. Please try again.</Alert>}
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
