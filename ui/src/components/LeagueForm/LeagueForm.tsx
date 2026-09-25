import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, MenuItem, Tab, Tabs } from '@mui/material'
import { Input } from '../Input'
import { WebsiteInput } from '../WebsiteInput'
import { MediaUpload } from '../MediaUpload'
import { SocialLinksFields } from '../SocialLinksFields'
import type { SocialLink } from '../marketing/SocialLinksRow'
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
  ageCutoffDate: string
  format: LeagueFormat | ''
  phone: string
  website: string
  email: string
  logoUrl: string | null
  socialLinks: SocialLink[]
}

type FormErrors = Partial<Record<'name' | 'maxPlayingXiSize' | 'ageRange' | 'website' | 'email', string>>

// Mirrors SponsorForm's own client-side-only checks — League.website/email have no backend
// @Pattern beyond basic type (docs/specs/053-league-extended-profile.md's Acceptance Criteria),
// same posture as Sponsor's identical fields.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WEBSITE_PATTERN = /^https?:\/\/.+/i

// Maps each validated field to the tab that holds it, so an error surfaces on a visible tab
// rather than silently failing on a hidden one — mirrors SponsorForm's FIELD_TAB; every validated
// field here lives on the Basic Info tab (index 0).
const FIELD_TAB: Record<keyof FormErrors, number> = {
  name: 0,
  maxPlayingXiSize: 0,
  ageRange: 0,
  website: 0,
  email: 0,
}

function toFormState(initialValues?: Partial<LeaguePayload>): FormState {
  return {
    name: initialValues?.name ?? '',
    maxPlayingXiSize: String(initialValues?.maxPlayingXiSize ?? 11),
    minAge: initialValues?.minAge != null ? String(initialValues.minAge) : '',
    maxAge: initialValues?.maxAge != null ? String(initialValues.maxAge) : '',
    ageCutoffDate: initialValues?.ageCutoffDate ?? '',
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
  const [activeTab, setActiveTab] = useState(0)

  const handleChange =
    (field: 'name' | 'maxPlayingXiSize' | 'minAge' | 'maxAge' | 'ageCutoffDate' | 'phone' | 'email') =>
    (event: ChangeEvent<HTMLInputElement>) => {
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

    const errorFields = Object.keys(validationErrors) as Array<keyof FormErrors>
    if (errorFields.length > 0) {
      const errorTab = Math.min(...errorFields.map((field) => FIELD_TAB[field] ?? 0))
      if (errorTab !== activeTab) {
        setActiveTab(errorTab)
      }
      return
    }

    const payload: LeaguePayload = {
      name: values.name.trim(),
      maxPlayingXiSize: Number(values.maxPlayingXiSize),
      minAge: values.minAge.trim() ? Number(values.minAge) : null,
      maxAge: values.maxAge.trim() ? Number(values.maxAge) : null,
      ageCutoffDate: values.ageCutoffDate.trim() ? values.ageCutoffDate : null,
      format: values.format || null,
      phone: blankToNull(values.phone),
      website: blankToNull(values.website),
      email: blankToNull(values.email),
      logoUrl: values.logoUrl,
      socialLinks: values.socialLinks,
    }
    onSubmit(payload)
  }

  return (
    <Box sx={{ gridColumn: '1 / -1' }}>
      <Tabs
        value={activeTab}
        onChange={(_event, next: number) => setActiveTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Basic Info" />
        <Tab label="Branding" />
        <Tab label="Social Media" />
      </Tabs>

      <Box
        component="form"
        id={LEAGUE_FORM_ID}
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}
      >
        {activeTab === 0 && (
          <>
            <Input
              label="Name"
              value={values.name}
              onChange={handleChange('name')}
              error={Boolean(errors.name)}
              helperText={errors.name ?? 'e.g. Riverside Internal T20 League'}
            />

            <Input
              label="Playing XI size"
              type="number"
              value={values.maxPlayingXiSize}
              onChange={handleChange('maxPlayingXiSize')}
              error={Boolean(errors.maxPlayingXiSize)}
              helperText={errors.maxPlayingXiSize ?? 'Defaults to 11 — set to 12 for a Vets league, for example'}
              inputProps={{ min: 1 }}
            />

            <Input
              label="Min age"
              type="number"
              value={values.minAge}
              onChange={handleChange('minAge')}
              error={Boolean(errors.ageRange)}
              helperText={errors.ageRange ?? 'Leave blank for no minimum'}
              inputProps={{ min: 0 }}
            />

            <Input
              label="Max age"
              type="number"
              value={values.maxAge}
              onChange={handleChange('maxAge')}
              error={Boolean(errors.ageRange)}
              helperText="Leave blank for no maximum"
              inputProps={{ min: 0 }}
            />

            <Input
              label="Age cutoff date"
              type="date"
              value={values.ageCutoffDate}
              onChange={handleChange('ageCutoffDate')}
              InputLabelProps={{ shrink: true }}
              helperText="Age as of this date — leave blank to use the match's own season start date"
            />

            <Input
              select
              label="Format"
              value={values.format}
              onChange={handleFormatChange}
              helperText="Purely descriptive — has no effect on Playing Conditions"
            >
              <MenuItem value="">Not specified</MenuItem>
              {(Object.keys(LEAGUE_FORMAT_LABELS) as LeagueFormat[]).map((format) => (
                <MenuItem key={format} value={format}>
                  {LEAGUE_FORMAT_LABELS[format]}
                </MenuItem>
              ))}
            </Input>

            <Input label="Phone" value={values.phone} onChange={handleChange('phone')} />

            <WebsiteInput value={values.website} onChange={handleWebsiteChange} error={errors.website} />

            <Input
              label="Email"
              type="email"
              value={values.email}
              onChange={handleChange('email')}
              error={Boolean(errors.email)}
              helperText={errors.email}
            />
          </>
        )}

        {activeTab === 1 && (
          <MediaUpload label="Logo" value={values.logoUrl} onUploaded={handleLogoUploaded} variant="logo" namespace="manage" />
        )}

        {activeTab === 2 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <SocialLinksFields value={values.socialLinks} onChange={handleSocialLinksChange} />
          </Box>
        )}
      </Box>
    </Box>
  )
}
