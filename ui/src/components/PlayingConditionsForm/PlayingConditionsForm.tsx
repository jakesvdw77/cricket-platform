import { useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { Box, Tooltip, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import { CompactSwitch } from '../CompactSwitch'
import { FormSectionHeading } from '../FormSectionHeading'
import { Input } from '../Input'
import { resolveEffectiveMaxOversPerBowler } from '../../utils/playingConditions'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'

// Stable id the <form> element renders with, mirrors LEAGUE_FORM_ID/TEAM_FORM_ID's own precedent: the Save button
// lives outside the form (the Playing conditions tab's footer, docs/specs/095) and submits it with form={this id}.
export const PLAYING_CONDITIONS_FORM_ID = 'playing-conditions-form'

export interface PlayingConditionsFormProps {
  // null/undefined when nothing has been saved yet for this league+season.
  initialValues?: PlayingConditionsPayload | null
  onSubmit: (payload: PlayingConditionsPayload) => void
}

interface FormState {
  maxOversPerInnings: string
  powerplayOvers: string
  maxOversPerBowler: string
  fieldingRestrictionsNotes: string
  allowSubstitutions: boolean
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

// docs/specs/052-league-playing-conditions.md UI Requirements item 2, a reasonable starting point
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
    allowSubstitutions: initialValues?.allowSubstitutions ?? false,
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
// invalid combination never round-trips to the backend just to be rejected, same posture
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

const fieldGridSx = { display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }

// docs/specs/052 (fields, validation, payload) restyled by docs/specs/095: FormSectionHeading sections (Innings, Points, Bonus
// points, Notes) in a three-column grid from md. There is no Save button in here: the tab's footer owns it and submits this
// form through PLAYING_CONDITIONS_FORM_ID, and shows the save error.
export function PlayingConditionsForm({ initialValues, onSubmit }: PlayingConditionsFormProps) {
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
      allowSubstitutions: values.allowSubstitutions,
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

  // Compact 40 px inputs, no helper text except validation errors: examples and the live "Auto (N)" are placeholders (so the
  // label stays shrunk above them), and the longer explanations live in an info-icon tooltip beside the field.
  const placeholderLabel = { shrink: true }
  const innings = (
    <>
      <Input
        label="Max overs per innings"
        type="number"
        placeholder="e.g. 20"
        InputLabelProps={placeholderLabel}
        value={values.maxOversPerInnings}
        onChange={handleChange('maxOversPerInnings')}
        error={Boolean(errors.maxOversPerInnings)}
        helperText={errors.maxOversPerInnings}
        inputProps={{ min: 1 }}
      />
      <Input
        label="Powerplay overs"
        type="number"
        placeholder="e.g. 6"
        InputLabelProps={placeholderLabel}
        value={values.powerplayOvers}
        onChange={handleChange('powerplayOvers')}
        error={Boolean(errors.powerplayOvers)}
        helperText={errors.powerplayOvers}
        inputProps={{ min: 1 }}
      />
      <FieldWithInfo info="Leave blank to use the standard ceil(overs ÷ 5) rule" infoLabel="About max overs per bowler">
        <Input
          label="Max overs per bowler"
          type="number"
          placeholder={autoMaxOversPerBowler != null ? `Auto (${autoMaxOversPerBowler})` : 'Auto'}
          InputLabelProps={placeholderLabel}
          value={values.maxOversPerBowler}
          onChange={handleChange('maxOversPerBowler')}
          error={Boolean(errors.maxOversPerBowler)}
          helperText={errors.maxOversPerBowler}
          inputProps={{ min: 1 }}
        />
      </FieldWithInfo>
      <Box sx={{ gridColumn: '1 / -1' }}>
        <FieldWithInfo
          multiline
          info="Optional: free text for circle/leg-side clauses too varied to model as fields"
          infoLabel="About fielding restrictions notes"
        >
          <Input
            label="Fielding restrictions notes"
            value={values.fieldingRestrictionsNotes}
            onChange={handleChange('fieldingRestrictionsNotes')}
            multiline
            minRows={2}
          />
        </FieldWithInfo>
      </Box>
      <Box sx={{ gridColumn: '1 / -1' }}>
        <CompactSwitch
          checked={values.allowSubstitutions}
          onChange={(checked) => setValues((prev) => ({ ...prev, allowSubstitutions: checked }))}
          label="Allow substitutions (e.g. Vets cricket, where a twelfth man may fully bat/bowl)"
          noWrap={false}
        />
      </Box>
    </>
  )

  return (
    <Box
      component="form"
      id={PLAYING_CONDITIONS_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <FormSectionHeading icon={<TimerOutlinedIcon />} title="Innings" />
      <Box sx={fieldGridSx}>{innings}</Box>

      <FormSectionHeading icon={<EmojiEventsOutlinedIcon />} title="Points" />
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

      <FormSectionHeading icon={<StarOutlineOutlinedIcon />} title="Bonus points" />
      <Box sx={fieldGridSx}>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <CompactSwitch
            checked={values.bonusPointsEnabled}
            onChange={(checked) => setValues((prev) => ({ ...prev, bonusPointsEnabled: checked }))}
            label="Enable bonus points"
          />
        </Box>
        {values.bonusPointsEnabled && (
          <>
            <FieldWithInfo
              info="e.g. 17: the batting-second side earns a bonus point for chasing before this over"
              infoLabel="About the early-chase overs threshold"
            >
              <Input
                label="Early-chase overs threshold"
                type="number"
                value={values.bonusBattingOversThreshold}
                onChange={handleChange('bonusBattingOversThreshold')}
                error={Boolean(errors.bonusThresholds)}
                inputProps={{ min: 1 }}
              />
            </FieldWithInfo>
            <FieldWithInfo
              info="e.g. 80: the bowling-second side earns a bonus point for restricting them to this % of the target"
              infoLabel="About the bowling restriction percentage"
            >
              <Input
                label="Bowling restriction %"
                type="number"
                value={values.bonusBowlingRestrictionPercentage}
                onChange={handleChange('bonusBowlingRestrictionPercentage')}
                error={Boolean(errors.bonusThresholds)}
                inputProps={{ min: 1, max: 100 }}
              />
            </FieldWithInfo>
          </>
        )}
      </Box>
      {errors.bonusThresholds && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
          {errors.bonusThresholds}
        </Typography>
      )}

      <FormSectionHeading icon={<NotesOutlinedIcon />} title="Notes" />
      <FieldWithInfo multiline info="Optional: anything club-specific that doesn't fit the fields above" infoLabel="About additional notes">
        <Input
          label="Additional notes"
          value={values.additionalNotes}
          onChange={handleChange('additionalNotes')}
          multiline
          minRows={2}
        />
      </FieldWithInfo>
    </Box>
  )
}

interface FieldWithInfoProps {
  children: ReactNode
  // The explanation, kept verbatim from the old helper text.
  info: string
  infoLabel: string
  multiline?: boolean
}

// A field with a small info icon beside it: the tooltip carries the text that used to sit under the field.
function FieldWithInfo({ children, info, infoLabel, multiline = false }: FieldWithInfoProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: multiline ? 'flex-start' : 'center', gap: 0.5, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      <Tooltip title={info} enterTouchDelay={0}>
        <InfoOutlinedIcon
          aria-label={infoLabel}
          role="img"
          tabIndex={0}
          fontSize="small"
          sx={{ color: 'text.secondary', flex: 'none', mt: multiline ? 1 : 0, cursor: 'help' }}
        />
      </Tooltip>
    </Box>
  )
}
