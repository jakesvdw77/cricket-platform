import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, FormHelperText, MenuItem, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import { FormSectionHeading } from '../FormSectionHeading'
import { Input } from '../Input'
import { WebsiteInput } from '../WebsiteInput'
import { MediaUpload } from '../MediaUpload'
import { SocialLinksFields } from '../SocialLinksFields'
import type { SocialLink } from '../marketing/SocialLinksRow'
import { cutoffError, DEFAULT_CUTOFF, MONTH_NAMES, maxDayInMonth } from '../../utils/ageCutoff'
import { LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import type { LeagueFormat, LeaguePayload } from '../../api/leagueApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see LeagueFormPage), same pattern as TEAM_FORM_ID/SPONSOR_FORM_ID.
export const LEAGUE_FORM_ID = 'league-form'

export interface LeagueFormProps {
  initialValues?: Partial<LeaguePayload>
  onSubmit: (payload: LeaguePayload) => void
}

interface FormState {
  name: string
  maxPlayingXiSize: string
  minAge: string
  maxAge: string
  // docs/specs/110: the cut-off is a month and a day (select values; '' = not chosen).
  ageCutoffMonth: string
  ageCutoffDay: string
  format: LeagueFormat | ''
  phone: string
  website: string
  email: string
  logoUrl: string | null
  socialLinks: SocialLink[]
}

type FormErrors = Partial<Record<'name' | 'maxPlayingXiSize' | 'ageRange' | 'cutoff' | 'website' | 'email', string>>

// Mirrors SponsorForm's own client-side-only checks — League.website/email have no backend
// @Pattern beyond basic type (docs/specs/053-league-extended-profile.md's Acceptance Criteria),
// same posture as Sponsor's identical fields.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WEBSITE_PATTERN = /^https?:\/\/.+/i

function toFormState(initialValues?: Partial<LeaguePayload>): FormState {
  return {
    name: initialValues?.name ?? '',
    maxPlayingXiSize: String(initialValues?.maxPlayingXiSize ?? 11),
    minAge: initialValues?.minAge != null ? String(initialValues.minAge) : '',
    maxAge: initialValues?.maxAge != null ? String(initialValues.maxAge) : '',
    // docs/specs/110: 31 December is the standing default. The Add form (no initialValues) opens with it; an edited
    // league shows exactly what is stored, so a league with no cut-off stays empty (a winter league).
    ageCutoffMonth: initialValues
      ? initialValues.ageCutoffMonth != null ? String(initialValues.ageCutoffMonth) : ''
      : String(DEFAULT_CUTOFF.month),
    ageCutoffDay: initialValues
      ? initialValues.ageCutoffDay != null ? String(initialValues.ageCutoffDay) : ''
      : String(DEFAULT_CUTOFF.day),
    format: initialValues?.format ?? '',
    phone: initialValues?.phone ?? '',
    website: initialValues?.website ?? '',
    email: initialValues?.email ?? '',
    logoUrl: initialValues?.logoUrl ?? null,
    socialLinks: initialValues?.socialLinks ?? [],
  }
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Name is required'
  }

  const xiSize = Number(values.maxPlayingXiSize)
  if (!values.maxPlayingXiSize.trim() || Number.isNaN(xiSize) || xiSize <= 0) {
    errors.maxPlayingXiSize = 'Enter a positive whole number'
  }

  // Mirrors the server's own minAge <= maxAge rule (docs/specs/029-league-management.md) so an
  // obviously-invalid range never round-trips to the backend just to be rejected.
  if (values.minAge.trim() && values.maxAge.trim() && Number(values.minAge) > Number(values.maxAge)) {
    errors.ageRange = 'Min age must be less than or equal to max age'
  }

  // docs/specs/110: both or neither, and the day must exist in the month (29 February is allowed).
  const month = values.ageCutoffMonth ? Number(values.ageCutoffMonth) : null
  const day = values.ageCutoffDay ? Number(values.ageCutoffDay) : null
  const cutoff = cutoffError(month, day)
  if (cutoff === 'pair') {
    errors.cutoff = month == null ? 'Choose the month as well as the day' : 'Choose the day as well as the month'
  } else if (cutoff === 'day' && month != null) {
    errors.cutoff = `${MONTH_NAMES[month - 1]} has no day ${day}. Choose a day from 1 to ${maxDayInMonth(month)}.`
  }

  if (values.website.trim() && !WEBSITE_PATTERN.test(values.website.trim())) {
    errors.website = 'Enter a valid website URL, e.g. https://example.com'
  }

  if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address'
  }

  return errors
}

// Blank string -> null, matching the backend's full-replace semantics — an admin clearing a
// field should actually clear it, same posture as SponsorForm's blankToNull.
function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

// Note: League.source is deliberately not exposed here — every League created through this UI is
// INTERNAL (the server default when omitted); source = EXTERNAL is a reserved placeholder for a
// future CricClubs sync with no UI of its own yet (docs/specs/029-league-management.md's
// Non-goals).
//
// docs/specs/053-league-extended-profile.md: restructured to mirror SponsorForm's own inner-Tabs
// shape (Basic Info/Branding/Social Media) now that League carries the same club-facing profile
// fields (logo, format, phone/website/email, social links) alongside its original scheduling
// fields — all of which stay on Basic Info, since none of them warrant their own tab.
export function LeagueForm({ initialValues, onSubmit }: LeagueFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})
  // docs/specs/110: true once the manager has chosen or cleared either cut-off field. Until then the form may fill
  // 31 December itself; afterwards it never touches the cut-off.
  const [cutoffTouched, setCutoffTouched] = useState(false)

  const handleChange =
    (field: 'name' | 'maxPlayingXiSize' | 'phone' | 'email') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }))
    }

  // docs/specs/110: the first age limit entered (none before, one now) fills an empty, untouched cut-off with
  // 31 December. A league loaded with a limit and no cut-off is a deliberate winter league, so it is never filled.
  const handleAgeChange = (field: 'minAge' | 'maxAge') => (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setValues((prev) => {
      const firstLimit = !prev.minAge.trim() && !prev.maxAge.trim() && next.trim() !== ''
      const cutoffEmpty = !prev.ageCutoffMonth && !prev.ageCutoffDay
      const fill = firstLimit && cutoffEmpty && !cutoffTouched
      return {
        ...prev,
        [field]: next,
        ...(fill ? { ageCutoffMonth: String(DEFAULT_CUTOFF.month), ageCutoffDay: String(DEFAULT_CUTOFF.day) } : {}),
      }
    })
  }

  const handleCutoffChange = (field: 'ageCutoffMonth' | 'ageCutoffDay') => (event: ChangeEvent<HTMLInputElement>) => {
    setCutoffTouched(true)
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleFormatChange = (event: ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, format: event.target.value as LeagueFormat | '' }))

  const handleWebsiteChange = (website: string) => setValues((prev) => ({ ...prev, website }))
  const handleLogoUploaded = (logoUrl: string) => setValues((prev) => ({ ...prev, logoUrl }))
  const handleSocialLinksChange = (socialLinks: SocialLink[]) => setValues((prev) => ({ ...prev, socialLinks }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: LeaguePayload = {
      name: values.name.trim(),
      maxPlayingXiSize: Number(values.maxPlayingXiSize),
      minAge: values.minAge.trim() ? Number(values.minAge) : null,
      maxAge: values.maxAge.trim() ? Number(values.maxAge) : null,
      ageCutoffMonth: values.ageCutoffMonth ? Number(values.ageCutoffMonth) : null,
      ageCutoffDay: values.ageCutoffDay ? Number(values.ageCutoffDay) : null,
      format: values.format || null,
      phone: blankToNull(values.phone),
      website: blankToNull(values.website),
      email: blankToNull(values.email),
      logoUrl: values.logoUrl,
      socialLinks: values.socialLinks,
    }
    onSubmit(payload)
  }

  // The note stays hidden while an Add form still shows its untouched 31 December default.
  const untouchedDefault = initialValues === undefined && !cutoffTouched
  const noEffect =
    Boolean(values.ageCutoffMonth && values.ageCutoffDay) && !values.minAge.trim() && !values.maxAge.trim() && !untouchedDefault

  return (
    // docs/specs/091 (D): one full-width form of three sections - Basic info, Contact and Branding and social - in place of
    // the inner Basic Info / Branding / Social Media tabs. "(optional)" sits in the label and only validation errors show.
    <Box
      component="form"
      id={LEAGUE_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <FormSectionHeading icon={<InfoOutlinedIcon />} title="Basic info" />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <Input label="Name" value={values.name} onChange={handleChange('name')} error={Boolean(errors.name)} helperText={errors.name} />

        <Input select label="Format" value={values.format} onChange={handleFormatChange}>
          <MenuItem value="">Not specified</MenuItem>
          {(Object.keys(LEAGUE_FORMAT_LABELS) as LeagueFormat[]).map((format) => (
            <MenuItem key={format} value={format}>
              {LEAGUE_FORMAT_LABELS[format]}
            </MenuItem>
          ))}
        </Input>

        <Input
          label="Playing XI size"
          type="number"
          value={values.maxPlayingXiSize}
          onChange={handleChange('maxPlayingXiSize')}
          error={Boolean(errors.maxPlayingXiSize)}
          helperText={errors.maxPlayingXiSize}
          inputProps={{ min: 1 }}
        />

        <Input
          label="Min age (optional)"
          type="number"
          value={values.minAge}
          onChange={handleAgeChange('minAge')}
          error={Boolean(errors.ageRange)}
          helperText={errors.ageRange}
          inputProps={{ min: 0 }}
        />

        <Input
          label="Max age (optional)"
          type="number"
          value={values.maxAge}
          onChange={handleAgeChange('maxAge')}
          error={Boolean(errors.ageRange)}
          inputProps={{ min: 0 }}
        />

        {/* docs/specs/110: the cut-off is a day and a month; the year is the one the league starts in. */}
        <Box
          role="group"
          aria-labelledby="league-cutoff-heading"
          sx={{ gridColumn: { xs: '1', md: '1 / -1' }, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <Typography id="league-cutoff-heading" variant="subtitle2" component="p">
            Age cut-off (day and month)
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
            <Input
              select
              label="Cut-off month (optional)"
              value={values.ageCutoffMonth}
              onChange={handleCutoffChange('ageCutoffMonth')}
              error={Boolean(errors.cutoff)}
            >
              <MenuItem value="">Not set</MenuItem>
              {MONTH_NAMES.map((name, index) => (
                <MenuItem key={name} value={String(index + 1)}>
                  {name}
                </MenuItem>
              ))}
            </Input>
            <Input
              select
              label="Cut-off day (optional)"
              value={values.ageCutoffDay}
              onChange={handleCutoffChange('ageCutoffDay')}
              error={Boolean(errors.cutoff)}
            >
              <MenuItem value="">Not set</MenuItem>
              {Array.from({ length: 31 }, (_, index) => (
                <MenuItem key={index + 1} value={String(index + 1)}>
                  {index + 1}
                </MenuItem>
              ))}
            </Input>
          </Box>
          {errors.cutoff && (
            <FormHelperText error role="alert" sx={{ mx: 0 }}>
              {errors.cutoff}
            </FormHelperText>
          )}
          <FormHelperText sx={{ mx: 0 }}>
            Ages are judged on this day in the year the league starts. Leave empty to judge ages on the day the league starts (for example a winter league).
          </FormHelperText>
          {noEffect && (
            <FormHelperText sx={{ mx: 0 }} data-testid="cutoff-no-effect">
              This cut-off has no effect until an age limit is set.
            </FormHelperText>
          )}
        </Box>
      </Box>

      <FormSectionHeading icon={<AlternateEmailIcon />} title="Contact" />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <Input label="Phone (optional)" value={values.phone} onChange={handleChange('phone')} />

        <WebsiteInput label="Website (optional)" value={values.website} onChange={handleWebsiteChange} error={errors.website} showHint={false} />

        <Input
          label="Email (optional)"
          type="email"
          value={values.email}
          onChange={handleChange('email')}
          error={Boolean(errors.email)}
          helperText={errors.email}
        />
      </Box>

      <FormSectionHeading icon={<PaletteOutlinedIcon />} title="Branding and social" />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr)' }, alignItems: 'start' }}>
        <MediaUpload label="Logo" value={values.logoUrl} onUploaded={handleLogoUploaded} variant="logo" namespace="manage" />
        <SocialLinksFields value={values.socialLinks} onChange={handleSocialLinksChange} />
      </Box>
    </Box>
  )
}
