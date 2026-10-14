import { Alert, Box, ToggleButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { Button } from '../../../../components/Button'
import { CompactToggleGroup } from '../../../../components/CompactToggleGroup'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { Input } from '../../../../components/Input'
import { OutcomeTiles } from '../../../../components/OutcomeTiles'
import { OversInput } from '../../../../components/OversInput'
import { SidePicker } from '../../../../components/SidePicker'
import type { ResultDecidedBy, ResultOutcomeType } from '../../../../api/matchResultApi'
import { addSuperOver, superOversOf, withoutSuperOvers } from '../resultDraftHelpers'
import { sidePickerOptions } from './sidePickerOptions'
import type { StepProps } from './stepTypes'

const labelSx = { fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 } as const

function toInt(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isInteger(value) && value >= 0 ? value : null
}

// docs/specs/100-match-results-core.md, step "Result": one outcome tile, then only the fields that outcome needs - the
// winner (Won, Forfeit), how it was decided (Won), and the DLS figures (the margin is set on Scores and margin). It ends with
// the quiet prompt to record who batted, bowled and fielded (docs/specs/101, decision 22).
export function OutcomeStep({ draft, onChange, onReplace, sides, disabled, scorecardAvailable, onGoToStep }: StepProps) {
  const outcome = draft.outcomeType ?? null
  const decidedBy = draft.decidedBy ?? 'REGULAR'
  const won = outcome === 'WON'
  const options = sidePickerOptions(sides)
  const ballsPerOver = draft.ballsPerOver ?? 6

  const chooseOutcome = (next: ResultOutcomeType) => {
    // Only a win can be decided by a super over, so any other outcome drops them from the form too.
    onReplace(next === 'WON' ? { ...draft, outcomeType: next } : { ...withoutSuperOvers(draft), outcomeType: next, decidedBy: 'REGULAR' })
  }

  const chooseDecidedBy = (next: ResultDecidedBy) => {
    const patched = { ...draft, decidedBy: next }
    // A super over win is a level score settled by at least one pair of super over innings; offer the first pair.
    // Super overs exist only while the win is decided by one: added here, removed when another choice is made.
    if (next === 'SUPER_OVER') onReplace(superOversOf(patched).length === 0 ? addSuperOver(patched) : patched)
    else onReplace(withoutSuperOvers(patched))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="info" sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: '0.8125rem' } }}>
        Now record how the match ended. The teams and the scorecard are optional, and the scores and winning margin are worked out for you later. The result decides which steps follow: a forfeit, abandoned match or no result skips Batting, Bowling and Awards.
      </Alert>
      <FormSectionHeading icon={<EmojiEventsOutlinedIcon />} title="How did the match end?" />
      <OutcomeTiles value={outcome} onChange={chooseOutcome} disabled={disabled} />

      {(won || outcome === 'FORFEIT') && (
        <Box>
          <Typography sx={labelSx}>{outcome === 'FORFEIT' ? 'Who received the win?' : 'Who won?'}</Typography>
          <SidePicker
            label={outcome === 'FORFEIT' ? 'Who received the win?' : 'Who won?'}
            options={options}
            value={draft.winningSide ?? null}
            onChange={(side) => onChange({ winningSide: side })}
            disabled={disabled}
          />
        </Box>
      )}

      {won && (
        <Box>
          <Typography sx={labelSx}>How was it decided?</Typography>
          <CompactToggleGroup<ResultDecidedBy> value={decidedBy} onChange={chooseDecidedBy} ariaLabel="How was it decided?" fullWidthOnPhone>
            <ToggleButton value="REGULAR">Normal</ToggleButton>
            <ToggleButton value="DLS">DLS</ToggleButton>
            <ToggleButton value="SUPER_OVER">Super over</ToggleButton>
          </CompactToggleGroup>
          {decidedBy === 'SUPER_OVER' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              The scores should be level; enter the super over on the Scores step.
            </Typography>
          )}
        </Box>
      )}

      {won && decidedBy === 'DLS' && (
        <Box
          sx={(theme) => ({
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'warning.main',
            borderRadius: 1,
            p: 1.5,
            bgcolor: alpha(theme.palette.warning.main, 0.05),
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '200px 200px' },
            gap: 1.5,
          })}
        >
          <Typography variant="caption" sx={{ gridColumn: '1 / -1', fontWeight: 600, color: 'warning.dark' }}>
            Duckworth-Lewis-Stern: the revised target and the revised innings length
          </Typography>
          <Input
            label="Revised target"
            type="number"
            value={draft.dlsTarget ?? ''}
            onChange={(event) => onChange({ dlsTarget: toInt(event.target.value) })}
            disabled={disabled}
            inputProps={{ min: 0, inputMode: 'numeric' }}
          />
          <OversInput
            label="Revised overs"
            value={draft.dlsRevisedBalls ?? null}
            onChange={(balls) => onChange({ dlsRevisedBalls: balls })}
            ballsPerOver={ballsPerOver}
            disabled={disabled}
          />
        </Box>
      )}


      {scorecardAvailable && onGoToStep && (
        <Box
          data-testid="scorecard-prompt"
          sx={{ p: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 220px' }}>
            Want to record who batted, bowled and fielded? It is optional.
          </Typography>
          <Button variant="secondary" size="sm" onClick={() => onGoToStep('batting')} disabled={disabled}>
            Add the batting and bowling
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onGoToStep('scores')} disabled={disabled}>
            Skip to scores
          </Button>
        </Box>
      )}
    </Box>
  )
}
