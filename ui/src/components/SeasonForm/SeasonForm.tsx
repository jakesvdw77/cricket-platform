import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box } from '@mui/material'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { Input } from '../Input'
import { FormSectionHeading } from '../FormSectionHeading'
import type { SeasonPayload } from '../../api/seasonApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see SeasonFormPage), same pattern as LEAGUE_FORM_ID/TEAM_FORM_ID.
export const SEASON_FORM_ID = 'season-form'

export interface SeasonFormProps {
  initialValues?: Partial<SeasonPayload>
  onSubmit: (payload: SeasonPayload) => void
}

interface FormState {
  label: string
  startDate: string
  endDate: string
}

type FormErrors = Partial<Record<'label' | 'startDate' | 'endDate' | 'dateRange', string>>

function toFormState(initialValues?: Partial<SeasonPayload>): FormState {
  return {
    label: initialValues?.label ?? '',
    startDate: initialValues?.startDate ?? '',
    endDate: initialValues?.endDate ?? '',
  }
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.label.trim()) {
    errors.label = 'Label is required'
  }

  if (!values.startDate) {
    errors.startDate = 'Start date is required'
  }

  if (!values.endDate) {
    errors.endDate = 'End date is required'
  }

  // Mirrors the server's own startDate <= endDate rule (docs/specs/029-league-management.md).
  if (values.startDate && values.endDate && values.startDate > values.endDate) {
    errors.dateRange = 'Start date must be on or before end date'
  }

  return errors
}

export function SeasonForm({ initialValues, onSubmit }: SeasonFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (field: 'label' | 'startDate' | 'endDate') => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: SeasonPayload = {
      label: values.label.trim(),
      startDate: values.startDate,
      endDate: values.endDate,
    }
    onSubmit(payload)
  }

  return (
    // docs/specs/094 (F): one "Season dates" section, Label / Start date / End date in three columns from md. No helper
    // text; only validation errors show under a field.
    <Box
      component="form"
      id={SEASON_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <FormSectionHeading icon={<EventOutlinedIcon />} title="Season dates" />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <Input label="Label" value={values.label} onChange={handleChange('label')} error={Boolean(errors.label)} helperText={errors.label} />

        <Input
          label="Start date"
          type="date"
          value={values.startDate}
          onChange={handleChange('startDate')}
          error={Boolean(errors.startDate)}
          helperText={errors.startDate}
          InputLabelProps={{ shrink: true }}
        />

        <Input
          label="End date"
          type="date"
          value={values.endDate}
          onChange={handleChange('endDate')}
          error={Boolean(errors.endDate) || Boolean(errors.dateRange)}
          helperText={errors.endDate ?? errors.dateRange}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
    </Box>
  )
}
