import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, Checkbox, FormControlLabel, MenuItem } from '@mui/material'
import { Input } from '../Input'
import { MediaUpload } from '../MediaUpload'
import type { PlayerPayload, Gender, BattingStance, BowlingArm, BowlingType } from '../../api/playerApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see PlayerFormPage), so its Save button targets this form via the native HTML
// `form="…"` attribute, same pattern as TEAM_FORM_ID/SPONSOR_FORM_ID.
export const PLAYER_FORM_ID = 'player-form'

// Byte-for-byte PlayerPayload (docs/specs/028-players.md) — a distinct alias purely so this
// component's public API reads in its own domain vocabulary, same as TeamFormValues aliasing
// TeamPayload-shaped fields.
export type PlayerFormValues = PlayerPayload

// A real, already-confirmed decision this session: PlayerForm does NOT own its own Tabs — unlike
// SponsorForm's self-contained Tabs, PlayerFormPage owns one flat 4-tab bar (Basic Info | Contact
// Info | Cricket Info | Sections) and passes down which of the first three field-group panels is
// active; the 4th (Sections) is rendered entirely by PlayerFormPage itself, since it needs a
// persisted player id this component never has access to.
export interface PlayerFormProps {
  activeTab: 0 | 1 | 2
  initialValues?: Partial<PlayerFormValues>
  onSubmit: (payload: PlayerFormValues) => void
}

interface FormState {
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: '' | Gender
  photoUrl: string | null
  clubMembershipNumber: string
  medicalAidProvider: string
  medicalAidMemberNumber: string
  phone: string
  email: string
  altContactName: string
  altContactPhone: string
  battingStance: '' | BattingStance
  bowlingArm: '' | BowlingArm
  bowlingType: '' | BowlingType
  isWicketKeeper: boolean
}

type TextField =
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'clubMembershipNumber'
  | 'medicalAidProvider'
  | 'medicalAidMemberNumber'
  | 'phone'
  | 'email'
  | 'altContactName'
  | 'altContactPhone'

type FormErrors = Partial<Record<'firstName' | 'lastName', string>>

// The exact BowlingType option list from the spec's UI Requirements — arm is already captured
// separately (Bowling arm), so this list is arm-independent style, not combined codes like "RFM".
const BOWLING_TYPE_OPTIONS: Array<{ value: BowlingType; label: string }> = [
  { value: 'FAST', label: 'Fast' },
  { value: 'FAST_MEDIUM', label: 'Fast-medium' },
  { value: 'MEDIUM_FAST', label: 'Medium-fast' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'OFF_BREAK', label: 'Off break' },
  { value: 'LEG_BREAK', label: 'Leg break' },
  { value: 'ORTHODOX_SPIN', label: 'Orthodox spin' },
  { value: 'WRIST_SPIN', label: 'Wrist spin / Chinaman' },
  { value: 'GOOGLY', label: 'Googly' },
]

function toFormState(initialValues?: Partial<PlayerFormValues>): FormState {
  return {
    firstName: initialValues?.firstName ?? '',
    lastName: initialValues?.lastName ?? '',
    dateOfBirth: initialValues?.dateOfBirth ?? '',
    gender: initialValues?.gender ?? '',
    photoUrl: initialValues?.photoUrl ?? null,
    clubMembershipNumber: initialValues?.clubMembershipNumber ?? '',
    medicalAidProvider: initialValues?.medicalAidProvider ?? '',
    medicalAidMemberNumber: initialValues?.medicalAidMemberNumber ?? '',
    phone: initialValues?.phone ?? '',
    email: initialValues?.email ?? '',
    altContactName: initialValues?.altContactName ?? '',
    altContactPhone: initialValues?.altContactPhone ?? '',
    battingStance: initialValues?.battingStance ?? '',
    bowlingArm: initialValues?.bowlingArm ?? '',
    bowlingType: initialValues?.bowlingType ?? '',
    isWicketKeeper: initialValues?.isWicketKeeper ?? false,
  }
}

// Mirrors the backend's @NotBlank on firstName/lastName only (CreatePlayerRequest/
// UpdatePlayerRequest) — every other field is independently optional, per the spec's Goals.
function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.firstName.trim()) {
    errors.firstName = 'First name is required'
  }

  if (!values.lastName.trim()) {
    errors.lastName = 'Last name is required'
  }

  return errors
}

// Blank string -> null, matching the backend's full-replace semantics — an admin clearing a
// field should actually clear it, same posture as SponsorForm/ClubForm's blankToNull.
function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function PlayerForm({ activeTab, initialValues, onSubmit }: PlayerFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (field: TextField) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleGenderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setValues((prev) => ({ ...prev, gender: value === '' ? '' : (value as Gender) }))
  }

  const handleBattingStanceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setValues((prev) => ({ ...prev, battingStance: value === '' ? '' : (value as BattingStance) }))
  }

  const handleBowlingArmChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setValues((prev) => ({ ...prev, bowlingArm: value === '' ? '' : (value as BowlingArm) }))
  }

  const handleBowlingTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setValues((prev) => ({ ...prev, bowlingType: value === '' ? '' : (value as BowlingType) }))
  }

  const handleWicketKeeperChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, isWicketKeeper: event.target.checked }))
  }

  const handlePhotoUploaded = (photoUrl: string) => setValues((prev) => ({ ...prev, photoUrl }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: PlayerFormValues = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      dateOfBirth: blankToNull(values.dateOfBirth),
      gender: values.gender === '' ? null : values.gender,
      photoUrl: values.photoUrl,
      clubMembershipNumber: blankToNull(values.clubMembershipNumber),
      medicalAidProvider: blankToNull(values.medicalAidProvider),
      medicalAidMemberNumber: blankToNull(values.medicalAidMemberNumber),
      phone: blankToNull(values.phone),
      email: blankToNull(values.email),
      altContactName: blankToNull(values.altContactName),
      altContactPhone: blankToNull(values.altContactPhone),
      battingStance: values.battingStance === '' ? null : values.battingStance,
      bowlingArm: values.bowlingArm === '' ? null : values.bowlingArm,
      bowlingType: values.bowlingType === '' ? null : values.bowlingType,
      isWicketKeeper: values.isWicketKeeper,
    }

    onSubmit(payload)
  }

  return (
    // display: 'contents' removes this <form> from the box tree so its children become direct
    // items of RecordFormScreen's field grid (see PlayerFormPage) — same pattern as
    // TeamForm/ClubContactForm's *_FORM_ID.
    <Box component="form" id={PLAYER_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      {activeTab === 0 && (
        <>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <MediaUpload
              label="Photo"
              value={values.photoUrl}
              onUploaded={handlePhotoUploaded}
              variant="logo"
              namespace="manage"
            />
          </Box>

          <Input
            label="First name"
            value={values.firstName}
            onChange={handleChange('firstName')}
            error={Boolean(errors.firstName)}
            helperText={errors.firstName}
          />
          <Input
            label="Last name"
            value={values.lastName}
            onChange={handleChange('lastName')}
            error={Boolean(errors.lastName)}
            helperText={errors.lastName}
          />
          <Input
            label="Date of birth"
            type="date"
            value={values.dateOfBirth}
            onChange={handleChange('dateOfBirth')}
            InputLabelProps={{ shrink: true }}
          />
          <Input label="Gender" select value={values.gender} onChange={handleGenderChange}>
            <MenuItem value="">Not specified</MenuItem>
            <MenuItem value="MALE">Male</MenuItem>
            <MenuItem value="FEMALE">Female</MenuItem>
          </Input>

          <Input
            label="Club membership number"
            value={values.clubMembershipNumber}
            onChange={handleChange('clubMembershipNumber')}
          />
          <Input
            label="Medical aid provider"
            value={values.medicalAidProvider}
            onChange={handleChange('medicalAidProvider')}
          />
          <Input
            label="Medical aid member number"
            value={values.medicalAidMemberNumber}
            onChange={handleChange('medicalAidMemberNumber')}
          />
        </>
      )}

      {activeTab === 1 && (
        <>
          <Input label="Phone" value={values.phone} onChange={handleChange('phone')} />
          <Input label="Email" type="email" value={values.email} onChange={handleChange('email')} />
          <Input
            label="Alternative contact name"
            value={values.altContactName}
            onChange={handleChange('altContactName')}
          />
          <Input
            label="Alternative contact phone"
            value={values.altContactPhone}
            onChange={handleChange('altContactPhone')}
          />
        </>
      )}

      {activeTab === 2 && (
        <>
          <Input label="Batting stance" select value={values.battingStance} onChange={handleBattingStanceChange}>
            <MenuItem value="">Not specified</MenuItem>
            <MenuItem value="RIGHT_HANDED">Right-handed</MenuItem>
            <MenuItem value="LEFT_HANDED">Left-handed</MenuItem>
          </Input>
          <Input label="Bowling arm" select value={values.bowlingArm} onChange={handleBowlingArmChange}>
            <MenuItem value="">Not specified</MenuItem>
            <MenuItem value="RIGHT_ARM">Right-arm</MenuItem>
            <MenuItem value="LEFT_ARM">Left-arm</MenuItem>
          </Input>
          <Input label="Bowling type" select value={values.bowlingType} onChange={handleBowlingTypeChange}>
            <MenuItem value="">Not specified</MenuItem>
            {BOWLING_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Input>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <FormControlLabel
              control={<Checkbox checked={values.isWicketKeeper} onChange={handleWicketKeeperChange} />}
              label="Wicketkeeper"
            />
          </Box>
        </>
      )}
    </Box>
  )
}
