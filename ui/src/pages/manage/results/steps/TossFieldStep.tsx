import { useState } from 'react'
import { Box, ToggleButton, Typography } from '@mui/material'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { Button } from '../../../../components/Button'
import { CompactToggleGroup } from '../../../../components/CompactToggleGroup'
import { FieldPicker } from '../../../../components/FieldPicker'
import type { FieldPickerValue } from '../../../../components/FieldPicker'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { Input } from '../../../../components/Input'
import { OversInput } from '../../../../components/OversInput'
import { SidePicker } from '../../../../components/SidePicker'
import type { TossDecision } from '../../../../api/matchResultApi'
import { withToss } from '../resultDraftHelpers'
import { sidePickerOptions } from './sidePickerOptions'
import type { StepProps } from './stepTypes'

const labelSx = { fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 } as const
const NOTE_MAX = 500

export interface TossFieldStepProps extends StepProps {
  // The league's overs per innings in balls (null for a friendly); the helper text shows while the value equals it.
  leagueScheduledBalls?: number | null
  // The field shown as played at: the match's own until the manager changes it.
  field: FieldPickerValue | null
  // True once the field differs from the match's scheduled one.
  fieldChanged: boolean
  onFieldChange: (field: FieldPickerValue | null) => void
}

// docs/specs/100-match-results-core.md, step 2 "Toss and field": who won the toss and chose to bat or bowl, the field
// (the match's, with Change field opening the Fields picker), the scheduled overs and an optional note.
export function TossFieldStep({ clubId, draft, onChange, onReplace, sides, disabled, field, fieldChanged, onFieldChange, leagueScheduledBalls, scorecardAvailable, onGoToStep }: TossFieldStepProps) {
  const [picking, setPicking] = useState(false)
  const ballsPerOver = draft.ballsPerOver ?? 6

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormSectionHeading icon={<SportsCricketOutlinedIcon />} title="Toss" />
      <Box>
        <Typography sx={labelSx}>Who won the toss?</Typography>
        <SidePicker
          label="Who won the toss?"
          options={sidePickerOptions(sides)}
          value={draft.tossWonBy ?? null}
          onChange={(side) => onReplace(withToss(draft, { tossWonBy: side, tossDecision: draft.tossDecision ?? null }))}
          disabled={disabled}
        />
        <Box sx={{ mt: 0.5 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReplace(withToss(draft, { tossWonBy: null, tossDecision: null }))}
            disabled={disabled || !draft.tossWonBy}
          >
            Not known / skip
          </Button>
        </Box>
      </Box>
      {draft.tossWonBy && (
        <Box>
          <Typography sx={labelSx}>They chose to</Typography>
          <CompactToggleGroup<TossDecision | ''>
            value={draft.tossDecision ?? ''}
            onChange={(next) => onReplace(withToss(draft, { tossWonBy: draft.tossWonBy ?? null, tossDecision: next === '' ? null : next }))}
            ariaLabel="Toss decision"
            fullWidthOnPhone
          >
            <ToggleButton value="BAT">Bat</ToggleButton>
            <ToggleButton value="BOWL">Bowl</ToggleButton>
          </CompactToggleGroup>
        </Box>
      )}

      <Box sx={{ pt: 1 }}>
        <FormSectionHeading icon={<PlaceOutlinedIcon />} title="Field and match length" />
      </Box>
      <Box>
        <Typography sx={labelSx}>Field played at</Typography>
        {picking ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FieldPicker
              clubId={clubId}
              label="Field played at"
              value={field}
              onChange={(next) => {
                onFieldChange(next)
                if (next) setPicking(false)
              }}
              disabled={disabled}
            />
            <Box>
              <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
                Done
              </Button>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'action.hover',
              px: 1.5,
              py: 1,
              minHeight: 48,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap color={field ? undefined : 'text.secondary'}>
                {field?.name ?? 'No field recorded'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fieldChanged ? 'Changed from the scheduled field' : 'Scheduled field for this match'}
              </Typography>
            </Box>
            <Button variant="ghost" size="sm" onClick={() => setPicking(true)} disabled={disabled}>
              Change field
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '240px 1fr' }, gap: 1.5, alignItems: 'start' }}>
        <OversInput
          label="Scheduled overs"
          value={draft.scheduledBalls ?? null}
          onChange={(balls) => onChange({ scheduledBalls: balls })}
          ballsPerOver={ballsPerOver}
          helperText={leagueScheduledBalls && draft.scheduledBalls === leagueScheduledBalls ? 'From league playing conditions' : undefined}
          disabled={disabled}
        />
        <Input
          label="Note (optional)"
          placeholder="Rain delay, start moved to 13:40"
          value={draft.note ?? ''}
          onChange={(event) => onChange({ note: event.target.value })}
          disabled={disabled}
          multiline
          minRows={2}
          inputProps={{ maxLength: NOTE_MAX }}
        />
      </Box>

      {scorecardAvailable && onGoToStep && (
        <Box
          data-testid="scorecard-prompt"
          sx={{ p: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 220px' }}>
            Want to record who batted, bowled and fielded? It is optional, and the scores are worked out from it.
          </Typography>
          <Button variant="secondary" size="sm" onClick={() => onGoToStep('our-team')} disabled={disabled}>
            Add our scorecard
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onGoToStep('scores')} disabled={disabled}>
            Skip to scores
          </Button>
        </Box>
      )}
    </Box>
  )
}
