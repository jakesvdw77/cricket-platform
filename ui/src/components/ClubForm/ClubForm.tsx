import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, MenuItem, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { ClubNameSlugFields } from '../ClubNameSlugFields'
import { AddressFields } from '../AddressFields'
import { PhoneInput } from '../PhoneInput'
import { WebsiteInput } from '../WebsiteInput'
import { MediaUpload } from '../MediaUpload'
import { Input } from '../Input'
import { SocialLinksFields } from '../SocialLinksFields'
import type { SocialLink } from '../marketing/SocialLinksRow'
import type { Address, ClubPayload, ClubProfilePayload, ClubProfileType } from '../../api/clubApi'
import { deriveSlug, validateSlug } from '../../utils/slug'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside
// this component (see ClubFormPage), so its Save button targets this form via the native
// HTML `form="…"` attribute rather than nesting a submit button inside the field grid.
export const CLUB_FORM_ID = 'club-form'

const PROFILE_TAB_LABEL = 'Save the club first'

export interface ClubFormProps {
  initialValues?: Partial<ClubPayload>
  // Only passed once a club exists and its profile has been fetched — undefined in create
  // mode, per docs/plans/012-club-profile.md item 7. Its presence (not its content) is what
  // gates whether the Contact/Address/Branding tabs and the org-type field are enabled.
  profileInitialValues?: Partial<ClubProfilePayload>
  // Defaults to 'full' — every existing platform_admin call site (ClubFormPage) is unaffected.
  // 'profileOnly' is for a /manage caller (docs/specs/020-club-manager-access.md): the caller's
  // club always already exists, so there's no Basic Info tab, no name/slug validation, and
  // onSubmit never receives a `club` key.
  mode?: 'full' | 'profileOnly'
  onSubmit: (values: { club?: ClubPayload; profile?: ClubProfilePayload }) => void
}

interface FormState {
  name: string
  slug: string
  type: ClubProfileType | ''
  email: string
  phone: string
  website: string
  address: Address
  logoUrl: string | null
  bannerUrl: string | null
  socialLinks: SocialLink[]
}

type FormErrors = Partial<Record<'name' | 'slug' | 'email' | 'website', string>>

// Maps each validated field to the tab that holds it, so an error surfaces on a visible tab
// rather than silently failing on a hidden one (docs/plans/012-club-profile.md item 7).
// Mode-aware (docs/plans/020-club-manager-access.md item 5): 'profileOnly' has no Basic Info
// tab (so no name/slug entries at all — they're never validated in this mode either) and
// Contact shifts from tab 1 to tab 0.
function fieldTab(showBasicInfo: boolean): Partial<Record<keyof FormErrors, number>> {
  if (!showBasicInfo) {
    return { email: 0, website: 0 }
  }
  return { name: 0, slug: 0, email: 1, website: 1 }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Mirrors UpdateClubProfileRequest's @Pattern(regexp = "^https?://.+") on the backend.
const WEBSITE_PATTERN = /^https?:\/\/.+/i

function emptyAddress(): Address {
  return { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null }
}

function toFormState(
  initialValues?: Partial<ClubPayload>,
  profileInitialValues?: Partial<ClubProfilePayload>,
): FormState {
  return {
    name: initialValues?.name ?? '',
    slug: initialValues?.slug ?? '',
    type: profileInitialValues?.type ?? '',
    email: profileInitialValues?.email ?? '',
    phone: profileInitialValues?.phone ?? '',
    website: profileInitialValues?.website ?? '',
    address: profileInitialValues?.address ?? emptyAddress(),
    logoUrl: profileInitialValues?.logoUrl ?? null,
    bannerUrl: profileInitialValues?.bannerUrl ?? null,
    socialLinks: profileInitialValues?.socialLinks ?? [],
  }
}

function validate(values: FormState, profileEnabled: boolean, showBasicInfo: boolean): FormErrors {
  const errors: FormErrors = {}

  if (showBasicInfo) {
    if (!values.name.trim()) {
      errors.name = 'Name is required'
    }

    const slugError = validateSlug(values.slug)
    if (slugError) {
      errors.slug = slugError
    }
  }

  if (profileEnabled) {
    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
      errors.email = 'Enter a valid email address'
    }

    if (values.website.trim() && !WEBSITE_PATTERN.test(values.website.trim())) {
      errors.website = 'Enter a valid website URL, e.g. https://example.com'
    }
  }

  return errors
}

// Blank string -> null, matching the backend's full-replace-nulls-out-omitted-fields semantics
// (docs/plans/012-club-profile.md Flag #4) — an admin clearing a field should actually clear it.
function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toAddressPayload(address: Address): Address {
  return {
    number: blankToNull(address.number ?? ''),
    street: blankToNull(address.street ?? ''),
    city: blankToNull(address.city ?? ''),
    provinceState: blankToNull(address.provinceState ?? ''),
    country: blankToNull(address.country ?? ''),
    postalCode: blankToNull(address.postalCode ?? ''),
  }
}

export function ClubForm({ initialValues, profileInitialValues, mode = 'full', onSubmit }: ClubFormProps) {
  const showBasicInfo = mode !== 'profileOnly'
  // A 'profileOnly' caller's club always already exists (a /manage caller is, by definition,
  // an already-provisioned club admin — docs/specs/020-club-manager-access.md), so the
  // Contact/Address/Branding tabs are always enabled in this mode, skipping the "Save the club
  // first" disabled/tooltip gating 'full' mode still needs in create mode.
  const profileEnabled = mode === 'profileOnly' ? true : profileInitialValues !== undefined
  const FIELD_TAB = fieldTab(showBasicInfo)
  // In 'full' mode Basic Info occupies tab 0, so Contact/Address/Branding start at 1. In
  // 'profileOnly' mode there's no Basic Info tab, so Contact/Address/Branding start at 0.
  const contactTab = showBasicInfo ? 1 : 0
  const addressTab = showBasicInfo ? 2 : 1
  const brandingTab = showBasicInfo ? 3 : 2
  const socialTab = showBasicInfo ? 4 : 3

  const [values, setValues] = useState<FormState>(() => toFormState(initialValues, profileInitialValues))
  const [errors, setErrors] = useState<FormErrors>({})
  const [activeTab, setActiveTab] = useState(0)
  // Once the admin has explicitly edited the slug (typed one in, or it arrived from
  // initialValues on edit — Club.slug is required, so an edit-mode club always has one already),
  // stop auto-deriving it from the name — never clobber a deliberate value.
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues?.slug))

  const handleNameChange = (name: string) => {
    setValues((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : deriveSlug(name) }))
  }

  const handleSlugChange = (slug: string) => {
    setSlugTouched(true)
    setValues((prev) => ({ ...prev, slug }))
  }

  const handleTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value as ClubProfileType | ''
    setValues((prev) => ({ ...prev, type: next }))
  }

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, email: event.target.value }))
  }

  const handlePhoneChange = (phone: string) => setValues((prev) => ({ ...prev, phone }))
  const handleWebsiteChange = (website: string) => setValues((prev) => ({ ...prev, website }))
  const handleAddressChange = (address: Address) => setValues((prev) => ({ ...prev, address }))
  const handleLogoUploaded = (logoUrl: string) => setValues((prev) => ({ ...prev, logoUrl }))
  const handleBannerUploaded = (bannerUrl: string) => setValues((prev) => ({ ...prev, bannerUrl }))
  const handleSocialLinksChange = (socialLinks: SocialLink[]) => setValues((prev) => ({ ...prev, socialLinks }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values, profileEnabled, showBasicInfo)
    setErrors(validationErrors)

    const errorFields = Object.keys(validationErrors) as Array<keyof FormErrors>
    if (errorFields.length > 0) {
      const errorTab = Math.min(...errorFields.map((field) => FIELD_TAB[field] ?? 0))
      if (errorTab !== activeTab) {
        setActiveTab(errorTab)
      }
      return
    }

    const club: ClubPayload | undefined = showBasicInfo
      ? {
          name: values.name.trim(),
          slug: values.slug.trim(),
        }
      : undefined

    const profile: ClubProfilePayload | undefined = profileEnabled
      ? {
          type: values.type || null,
          logoUrl: values.logoUrl,
          bannerUrl: values.bannerUrl,
          address: toAddressPayload(values.address),
          email: blankToNull(values.email),
          phone: blankToNull(values.phone),
          website: blankToNull(values.website),
          // Omitted entirely (rather than sent as an empty array) when there are none — matches
          // the backend's "omitting clears any existing links" semantics, and keeps a club that
          // never touches this tab producing the exact same payload shape it always has.
          ...(values.socialLinks.length > 0 && { socialLinks: values.socialLinks }),
        }
      : undefined

    onSubmit({ ...(club && { club }), ...(profile && { profile }) })
  }

  // Extracted since 'profileOnly' mode also renders this in the Contact tab (there's no Basic
  // Info tab to host it there) — was previously copy-pasted in both places, flagged by
  // standards-reviewer during docs/specs/020-club-manager-access.md's review.
  const renderTypeField = (disabled: boolean) => (
    <Input
      select
      label="Type"
      value={values.type}
      onChange={handleTypeChange}
      disabled={disabled}
      helperText={disabled ? 'Save the club first to set this.' : undefined}
    >
      <MenuItem value="">Not set</MenuItem>
      <MenuItem value="CLUB">Club</MenuItem>
      <MenuItem value="ACADEMY">Academy</MenuItem>
      <MenuItem value="SCHOOL">School</MenuItem>
      <MenuItem value="OTHER">Other</MenuItem>
    </Input>
  )

  const renderTab = (label: string) => {
    const tab = <Tab key={label} label={label} disabled={!profileEnabled} />
    if (profileEnabled) {
      return tab
    }
    // Tooltip lives inside the label, not wrapped around the whole Tab — wrapping the Tab
    // itself would break MUI Tabs' child-cloning (it expects a Tab as the direct child), see
    // docs/plans/012-club-profile.md's Basic-Info-only-in-create-mode note. describeChild keeps
    // the tab's own accessible name as its visible label ("Contact") — Tooltip's default
    // behaviour (aria-label) would otherwise replace it with the tooltip text entirely.
    return (
      <Tab
        key={label}
        disabled
        label={
          <Tooltip title={PROFILE_TAB_LABEL} describeChild>
            <span>{label}</span>
          </Tooltip>
        }
      />
    )
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
        {showBasicInfo && <Tab label="Basic Info" />}
        {renderTab('Contact')}
        {renderTab('Address')}
        {renderTab('Branding')}
        {renderTab('Social Media')}
      </Tabs>

      <Box
        component="form"
        id={CLUB_FORM_ID}
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}
      >
        {showBasicInfo && activeTab === 0 && (
          <>
            <ClubNameSlugFields
              name={values.name}
              slug={values.slug}
              slugTouched={slugTouched}
              nameError={errors.name}
              slugError={errors.slug}
              onNameChange={handleNameChange}
              onSlugChange={handleSlugChange}
            />
            {renderTypeField(!profileEnabled)}
          </>
        )}

        {activeTab === contactTab && profileEnabled && (
          <>
            {/* No Basic Info tab in 'profileOnly' mode, so the org-type field lives here
                instead — the Contact tab is otherwise the first (index 0) tab in that mode. */}
            {!showBasicInfo && renderTypeField(false)}
            <Input
              label="Email"
              type="email"
              value={values.email}
              onChange={handleEmailChange}
              error={Boolean(errors.email)}
              helperText={errors.email}
            />
            <PhoneInput value={values.phone} onChange={handlePhoneChange} />
            <WebsiteInput value={values.website} onChange={handleWebsiteChange} error={errors.website} />
          </>
        )}

        {activeTab === addressTab && profileEnabled && (
          <AddressFields value={values.address} onChange={handleAddressChange} />
        )}

        {activeTab === brandingTab && profileEnabled && (
          <>
            <MediaUpload
              label="Logo"
              value={values.logoUrl}
              onUploaded={handleLogoUploaded}
              variant="logo"
              namespace={mode === 'profileOnly' ? 'manage' : 'platform'}
            />
            <MediaUpload
              label="Banner"
              value={values.bannerUrl}
              onUploaded={handleBannerUploaded}
              variant="banner"
              namespace={mode === 'profileOnly' ? 'manage' : 'platform'}
            />
          </>
        )}

        {activeTab === socialTab && profileEnabled && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <SocialLinksFields value={values.socialLinks} onChange={handleSocialLinksChange} />
          </Box>
        )}

        {activeTab !== 0 && !profileEnabled && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="body2" color="text.secondary">
              {PROFILE_TAB_LABEL}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
