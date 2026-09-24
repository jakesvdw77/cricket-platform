import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material'
import { Input } from '../Input'
import { Button } from '../Button'
import { errorDetail } from '../../utils/errorDetail'
import { resolveEffectiveMaxOversPerBowler } from '../../utils/playingConditions'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'

// Stable id the <form> element renders with — mirrors LEAGUE_FORM_ID/TEAM_FORM_ID's own precedent,
// even though (unlike LeagueForm) this form's Save button lives inside itself rather than a
// parent RecordFormScreen actions bar — see this component's own doc comment below.
export const PLAYING_CONDITIONS_FORM_ID = 'playing-conditions-form'

export interface PlayingConditionsFormProps {
  // null/undefined when nothing has been saved yet for this league+season.
  initialValues?: PlayingConditionsPayload | null
  onSubmit: (payload: PlayingConditionsPayload) => void
  pending: boolean
  error?: unknown
}

interface FormState {
  maxOversPerInnings: string
  powerplayOvers: string
  maxOversPerBowler: string
  fieldingRestrictionsNotes: string
  pointsForWin: string
  pointsForLoss: string
  pointsForDraw: string
  pointsForNoResult: string
  pointsForForfeitWin: string
  bonusPointsEnabled: boolean
  bonusBattingOversThreshold: string
  bonusBowlingRestrictionPercentage: string
  additionalNotes: string
}

type PointsField = 'pointsForWin' | 'pointsForLoss' | 'pointsForDraw' | 'pointsForNoResult' | 'pointsForForfeitWin'
type TextField =
  | 'maxOversPerInnings'
  | 'powerplayOvers'
  | 'maxOversPerBowler'
  | 'fieldingRestrictionsNotes'
  | PointsField
  | 'bonusBattingOversThreshold'
  | 'bonusBowlingRestrictionPercentage'
  | 'additionalNotes'

type FormErrors = Partial<
  Record<'maxOversPerInnings' | 'powerplayOvers' | 'maxOversPerBowler' | PointsField | 'bonusThresholds', string>
>

const POINTS_FIELDS: { field: PointsField; label: string }[] = [
  { field: 'pointsForWin', label: 'Points for win' },
  { field: 'pointsForLoss', label: 'Points for loss' },
  { field: 'pointsForDraw', label: 'Points for draw' },
  { field: 'pointsForNoResult', label: 'Points for no result' },
  { field: 'pointsForForfeitWin', label: 'Points for forfeit win' },
]

// docs/specs/052-league-playing-conditions.md UI Requirements item 2 — a reasonable starting point
// for a typical T20 league so a first-ever save isn't a wall of empty required fields, matching
// LeagueForm's own precedent of defaulting maxPlayingXiSize to 11. Only seeded when initialValues
// is absent; every value remains freely editable.
const DEFAULT_POINTS: Record<PointsField, number> = {
  pointsForWin: 2,
  pointsForLoss: 0,
  pointsForDraw: 1,
  pointsForNoResult: 1,
  pointsForForfeitWin: 2,
}

function toFormState(initialValues?: PlayingConditionsPayload | null): FormState {
  return {
    maxOversPerInnings: initialValues?.maxOversPerInnings != null ? String(initialValues.maxOversPerInnings) : '',
    powerplayOvers: initialValues?.powerplayOvers != null ? String(initialValues.powerplayOvers) : '',
    maxOversPerBowler: initialValues?.maxOversPerBowler != null ? String(initialValues.maxOversPerBowler) : '',
    fieldingRestrictionsNotes: initialValues?.fieldingRestrictionsNotes ?? '',
    pointsForWin: String(initialValues?.pointsForWin ?? DEFAULT_POINTS.pointsForWin),
    pointsForLoss: String(initialValues?.pointsForLoss ?? DEFAULT_POINTS.pointsForLoss),
    pointsForDraw: String(initialValues?.pointsForDraw ?? DEFAULT_POINTS.pointsForDraw),
    pointsForNoResult: String(initialValues?.pointsForNoResult ?? DEFAULT_POINTS.pointsForNoResult),
    pointsForForfeitWin: String(initialValues?.pointsForForfeitWin ?? DEFAULT_POINTS.pointsForForfeitWin),
    bonusPointsEnabled: initialValues?.bonusPointsEnabled ?? false,
    bonusBattingOversThreshold:
      initialValues?.bonusBattingOversThreshold != null ? String(initialValues.bonusBattingOversThreshold) : '',
    bonusBowlingRestrictionPercentage:
      initialValues?.bonusBowlingRestrictionPercentage != null
        ? String(initialValues.bonusBowlingRestrictionPercentage)
        : '',
    additionalNotes: initialValues?.additionalNotes ?? '',
  }
}

// Mirrors the server's own cross-field validation (UpdateLeaguePlayingConditionsRequest's bean
// validation plus LeaguePlayingConditionsServiceImpl.update()'s cross-field rules) so an obviously-
// invalid combination never round-trips to the backend just to be rejected — same posture
// LeagueForm's own validate() already documents for minAge <= maxAge.
function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  const maxOversPerInnings = Number(values.maxOversPerInnings)
  const maxOversPerInningsValid = values.maxOversPerInnings.trim() && !Number.isNaN(maxOversPerInnings) && maxOversPerInnings > 0
  if (!maxOversPerInningsValid) {
    errors.maxOversPerInnings = 'Enter a positive whole number'
  }

  const powerplayOvers = Number(values.powerplayOvers)
  if (!values.powerplayOvers.trim() || Number.isNaN(powerplayOvers) || powerplayOvers <= 0) {
    errors.powerplayOvers = 'Enter a positive whole number'
  } else if (maxOversPerInningsValid && powerplayOvers > maxOversPerInnings) {
    errors.powerplayOvers = 'Must be less than or equal to max overs per innings'
  }

  if (values.maxOversPerBowler.trim()) {
    const maxOversPerBowler = Number(values.maxOversPerBowler)
    if (Number.isNaN(maxOversPerBowler) || maxOversPerBowler <= 0) {
      errors.maxOversPerBowler = 'Enter a positive whole number'
    } else if (maxOversPerInningsValid && maxOversPerBowler > maxOversPerInnings) {
      errors.maxOversPerBowler = 'Must be less than or equal to max overs per innings'
    }
  }

  POINTS_FIELDS.forEach(({ field }) => {
    const value = Number(values[field])
    if (!values[field].trim() || Number.isNaN(value) || value < 0) {
      errors[field] = 'Enter a whole number, 0 or greater'
    }
  })

  if (values.bonusPointsEnabled) {
    if (!values.bonusBattingOversThreshold.trim() || !values.bonusBowlingRestrictionPercentage.trim()) {
      errors.bonusThresholds = 'Both bonus-point fields are required while bonus points are enabled'
    } else {
      const bonusBattingOversThreshold = Number(values.bonusBattingOversThreshold)
      if (maxOversPerInningsValid && bonusBattingOversThreshold > maxOversPerInnings) {
        errors.bonusThresholds = 'Early-chase overs threshold must be less than or equal to max overs per innings'
      }
    }
  }

  return errors
}

export function PlayingConditionsForm({ initialValues, onSubmit, pending, error }: PlayingConditionsFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (field: TextField) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: PlayingConditionsPayload = {
      maxOversPerInnings: Number(values.maxOversPerInnings),
      powerplayOvers: Number(values.powerplayOvers),
      maxOversPerBowler: values.maxOversPerBowler.trim() ? Number(values.maxOversPerBowler) : null,
      fieldingRestrictionsNotes: values.fieldingRestrictionsNotes.trim() || null,
      pointsForWin: Number(values.pointsForWin),
      pointsForLoss: Number(values.pointsForLoss),
      pointsForDraw: Number(values.pointsForDraw),
      pointsForNoResult: Number(values.pointsForNoResult),
      pointsForForfeitWin: Number(values.pointsForForfeitWin),
      bonusPointsEnabled: values.bonusPointsEnabled,
      bonusBattingOversThreshold:
        values.bonusPointsEnabled && values.bonusBattingOversThreshold.trim()
          ? Number(values.bonusBattingOversThreshold)
          : null,
      bonusBowlingRestrictionPercentage:
        values.bonusPointsEnabled && values.bonusBowlingRestrictionPercentage.trim()
          ? Number(values.bonusBowlingRestrictionPercentage)
          : null,
      additionalNotes: values.additionalNotes.trim() || null,
    }
    onSubmit(payload)
  }

  const maxOversPerInningsNum = values.maxOversPerInnings.trim() ? Number(values.maxOversPerInnings) : null
  const autoMaxOversPerBowler = resolveEffectiveMaxOversPerBowler(maxOversPerInningsNum, null)
  const maxOversPerBowlerHelperText =
    errors.maxOversPerBowler ??
    `Leave blank to use the standard ceil(overs ÷ 5) rule${autoMaxOversPerBowler != null ? ` (auto: ${autoMaxOversPerBowler})` : ''}`

  const fieldGridSx = { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mt: 1.5 }
  const groupHeadingSx = { display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }

  return (
    <Box component="form" id={PLAYING_CONDITIONS_FORM_ID} onSubmit={handleSubmit} noValidate>
      <Stack spacing={4}>
        <Box>
          <Typography variant="subtitle2" sx={groupHeadingSx}>
            Match Format
          </Typography>
          <Box sx={fieldGridSx}>
            <Input
              label="Max overs per innings"
              type="number"
              value={values.maxOversPerInnings}
              onChange={handleChange('maxOversPerInnings')}
              error={Boolean(errors.maxOversPerInnings)}
              helperText={errors.maxOversPerInnings ?? 'e.g. 20 for a T20 league'}
              inputProps={{ min: 1 }}
            />
            <Input
              label="Powerplay overs"
              type="number"
              value={values.powerplayOvers}
              onChange={handleChange('powerplayOvers')}
              error={Boolean(errors.powerplayOvers)}
              helperText={errors.powerplayOvers ?? 'e.g. 6'}
              inputProps={{ min: 1 }}
            />
            <Input
              label="Max overs per bowler"
              type="number"
              value={values.maxOversPerBowler}
              onChange={handleChange('maxOversPerBowler')}
              error={Boolean(errors.maxOversPerBowler)}
              helperText={maxOversPerBowlerHelperText}
              inputProps={{ min: 1 }}
            />
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Input
                label="Fielding restrictions notes"
                value={values.fieldingRestrictionsNotes}
                onChange={handleChange('fieldingRestrictionsNotes')}
                multiline
                minRows={3}
                helperText="Optional — free text for circle/leg-side clauses too varied to model as fields"
              />
            </Box>
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={groupHeadingSx}>
            Points System
          </Typography>
          <Box sx={fieldGridSx}>
            {POINTS_FIELDS.map(({ field, label }) => (
              <Input
                key={field}
                label={label}
                type="number"
                value={values[field]}
                onChange={handleChange(field)}
                error={Boolean(errors[field])}
                helperText={errors[field]}
                inputProps={{ min: 0 }}
              />
            ))}
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={groupHeadingSx}>
            Bonus Points
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.bonusPointsEnabled}
                  onChange={(event) => setValues((prev) => ({ ...prev, bonusPointsEnabled: event.target.checked }))}
                />
              }
              label="Enable bonus points"
            />
          </Box>
          {values.bonusPointsEnabled && (
            <Box sx={fieldGridSx}>
              <Input
                label="Early-chase overs threshold"
                type="number"
                value={values.bonusBattingOversThreshold}
                onChange={handleChange('bonusBattingOversThreshold')}
                error={Boolean(errors.bonusThresholds)}
                helperText="e.g. 17 — the batting-second side earns a bonus point for chasing before this over"
                inputProps={{ min: 1 }}
              />
              <Input
                label="Bowling restriction %"
                type="number"
                value={values.bonusBowlingRestrictionPercentage}
                onChange={handleChange('bonusBowlingRestrictionPercentage')}
                error={Boolean(errors.bonusThresholds)}
                helperText="e.g. 80 — the bowling-second side earns a bonus point for restricting them to this % of the target"
                inputProps={{ min: 1, max: 100 }}
              />
            </Box>
          )}
          {errors.bonusThresholds && (
            <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 1 }}>
              {errors.bonusThresholds}
            </Typography>
          )}
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={groupHeadingSx}>
            Additional Notes
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            <Input
              label="Additional notes"
              value={values.additionalNotes}
              onChange={handleChange('additionalNotes')}
              multiline
              minRows={3}
              helperText="Optional — anything club-specific that doesn't fit the fields above"
            />
          </Box>
        </Box>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {error && (
            <Typography variant="body2" color="error.main">
              {errorDetail(error, 'Something went wrong saving Playing Conditions. Please try again.')}
            </Typography>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save Playing Conditions'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
