import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, Tab, Tabs } from '@mui/material'
import { Input } from '../Input'
import { WebsiteInput } from '../WebsiteInput'
import { MediaUpload } from '../MediaUpload'
import { SocialLinksFields } from '../SocialLinksFields'
import type { SocialLink } from '../marketing/SocialLinksRow'
import type { SponsorPayload } from '../../api/sponsorApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see SponsorFormPage), so its Save button targets this form via the native HTML
// `form="…"` attribute, same pattern as CLUB_FORM_ID/CLUB_CONTACT_FORM_ID.
export const SPONSOR_FORM_ID = 'sponsor-form'

export interface SponsorFormProps {
  initialValues?: Partial<SponsorPayload>
  onSubmit: (payload: SponsorPayload) => void
}

interface FormState {
  name: string
  website: string
  email: string
  phone: string
  logoUrl: string | null
  bannerUrl: string | null
  socialLinks: SocialLink[]
}

type FormErrors = Partial<Record<'name' | 'website' | 'email', string>>

// Mirrors ClubForm's own client-side checks for ContactDto-style backend rules — Name is the
// only required field (a Sponsor's own website/email/phone are optional general contact info,
// unlike ClubContact's @NotBlank fields), Email/Website are format-checked only if provided.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Client-side only — Sponsor's own website field has no backend @Pattern (unlike SocialLinkDto's
// url), so this is the sole guard; same regex ClubForm/SocialLinksFields validate a URL against.
const WEBSITE_PATTERN = /^https?:\/\/.+/i

// Maps each validated field to the tab that holds it, so an error surfaces on a visible tab
// rather than silently failing on a hidden one — same pattern as ClubForm's fieldTab, but every
// field here lives on the Basic Info tab (index 0); there is no equivalent to ClubForm's
// showBasicInfo/profileEnabled branching since every tab in SponsorForm is always enabled.
const FIELD_TAB: Record<keyof FormErrors, number> = { name: 0, website: 0, email: 0 }

function toFormState(initialValues?: Partial<SponsorPayload>): FormState {
  return {
    name: initialValues?.name ?? '',
    website: initialValues?.website ?? '',
    email: initialValues?.email ?? '',
    phone: initialValues?.phone ?? '',
    logoUrl: initialValues?.logoUrl ?? null,
    bannerUrl: initialValues?.bannerUrl ?? null,
    socialLinks: initialValues?.socialLinks ?? [],
  }
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Name is required'
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
// field should actually clear it, same posture as ClubForm's blankToNull.
function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

// Sponsor is one entity created in one POST — no ClubProfile-style "save the parent first"
// two-step flow — so unlike ClubForm, every tab here is enabled from the start, in both create
// and edit mode. No Tooltip, no profileEnabled/showBasicInfo branching at all
// (docs/plans/023-sponsors.md's Context section).
export function SponsorForm({ initialValues, onSubmit }: SponsorFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})
  const [activeTab, setActiveTab] = useState(0)

  const handleChange = (field: 'name' | 'email' | 'phone') => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleWebsiteChange = (website: string) => setValues((prev) => ({ ...prev, website }))
  const handleLogoUploaded = (logoUrl: string) => setValues((prev) => ({ ...prev, logoUrl }))
  const handleBannerUploaded = (bannerUrl: string) => setValues((prev) => ({ ...prev, bannerUrl }))
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

    const payload: SponsorPayload = {
      name: values.name.trim(),
      website: blankToNull(values.website),
      email: blankToNull(values.email),
      phone: blankToNull(values.phone),
      logoUrl: values.logoUrl,
      bannerUrl: values.bannerUrl,
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
        id={SPONSOR_FORM_ID}
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
              helperText={errors.name}
            />
            <WebsiteInput value={values.website} onChange={handleWebsiteChange} error={errors.website} />
            <Input
              label="Email"
              type="email"
              value={values.email}
              onChange={handleChange('email')}
              error={Boolean(errors.email)}
              helperText={errors.email}
            />
            <Input label="Phone" value={values.phone} onChange={handleChange('phone')} />
          </>
        )}

        {activeTab === 1 && (
          <>
            <MediaUpload
              label="Logo"
              value={values.logoUrl}
              onUploaded={handleLogoUploaded}
              variant="logo"
              namespace="manage"
            />
            <MediaUpload
              label="Banner"
              value={values.bannerUrl}
              onUploaded={handleBannerUploaded}
              variant="banner"
              namespace="manage"
            />
          </>
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
