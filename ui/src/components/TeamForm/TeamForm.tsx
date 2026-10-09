import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Avatar, Box, Stack, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import { FormSectionHeading } from '../FormSectionHeading'
import { Input } from '../Input'
import { Button } from '../Button'
import { MediaUpload } from '../MediaUpload'
import { SectionTreeSelect } from '../SectionTreeSelect'
import { SocialLinksFields } from '../SocialLinksFields'
import type { SocialLink } from '../marketing/SocialLinksRow'
import type { Section } from '../../api/sectionApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see TeamFormPage), so its Save button targets this form via the native HTML
// `form="…"` attribute, same pattern as CLUB_CONTACT_FORM_ID/SPONSOR_FORM_ID.
export const TEAM_FORM_ID = 'team-form'

export interface TeamFormValues {
  name: string
  sectionId?: string
  // Nullable — same posture as Sponsor/ClubProfile's own logoUrl fields. Captured on both create
  // and edit (docs/specs/027-team-profile.md), unlike the contacts/sponsors sections which only
  // ever render in edit mode.
  logoUrl?: string | null
  // docs/specs/057-team-extended-profile.md: the same club-facing profile shape 053 already gave
  // LeagueForm. docs/specs/092: all of it renders in this one form's two sections, not in separate tabs.
  abbreviation?: string | null
  groundName?: string | null
  socialLinks?: SocialLink[]
  // docs/specs/064-unified-availability-polls.md removed 063's squadMode: how a match's squad is
  // sourced now follows the poll covering the match, not a team setting.
}

export interface TeamFormProps {
  initialValues?: Partial<TeamFormValues>
  onSubmit: (payload: TeamFormValues) => void
  // Optional — when supplied, a required Section picker renders above the name field (the
  // club-wide directory's create flow, where the team's section hasn't been chosen yet). When
  // omitted, no section field renders at all (the section-scoped create/edit flow, where the
  // section is already fixed by the route — editing never exposes a section field, see
  // docs/specs/026-teams.md's re-parenting Non-goal). One component, two modes. Full Section[]
  // (not just {id, name}) — SectionTreeSelect needs parentSectionId to render the real hierarchy.
  sections?: Section[]
  // The club's own logo (020's getManagedClubProfile, resolved by TeamFormPage) — drives the
  // "using your club's logo" fallback caption/preview shown whenever the team has no logo
  // override of its own (docs/specs/027-team-profile.md).
  clubLogoUrl?: string | null
  // True while TeamFormPage is showing one of its OWN Contacts/Sponsors/Squad tabs — this form
  // stays mounted (state preserved) but visually hidden (`display: none`) rather than unmounted.
  hidden?: boolean
  // Called instead of just setting local field errors when client-side validation fails (blank
  // name / missing section) — the parent now owns switching its own outer Tabs back to Details.
  onInvalid?: () => void
}

type FormErrors = Partial<Record<'name' | 'sectionId', string>>

function validate(name: string, sectionId: string, requireSection: boolean): FormErrors {
  const errors: FormErrors = {}

  if (!name.trim()) {
    errors.name = 'Name is required'
  }

  if (requireSection && !sectionId) {
    errors.sectionId = 'Section is required'
  }

  return errors
}

// Blank string -> null, matching the backend's full-replace semantics — an admin clearing a
// field should actually clear it, same posture as LeagueForm/SponsorForm's own blankToNull.
function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function TeamForm({ initialValues, onSubmit, sections, clubLogoUrl, hidden, onInvalid }: TeamFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [sectionId, setSectionId] = useState(initialValues?.sectionId ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(initialValues?.logoUrl ?? null)
  const [abbreviation, setAbbreviation] = useState(initialValues?.abbreviation ?? '')
  const [groundName, setGroundName] = useState(initialValues?.groundName ?? '')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(initialValues?.socialLinks ?? [])
  const [errors, setErrors] = useState<FormErrors>({})

  const requireSection = Boolean(sections)

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
  }

  const handleAbbreviationChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAbbreviation(event.target.value)
  }

  const handleGroundNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setGroundName(event.target.value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(name, sectionId, requireSection)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      // Both validated fields (name, sectionId) live on the Details section — the parent
      // (TeamFormPage) owns switching its own outer Tabs back to Details, same
      // switch-to-the-tab-with-the-error intent SponsorForm/LeagueForm already use.
      onInvalid?.()
      return
    }

    const payload: TeamFormValues = {
      name: name.trim(),
      ...(requireSection ? { sectionId } : {}),
      logoUrl,
      abbreviation: blankToNull(abbreviation),
      groundName: blankToNull(groundName),
      socialLinks,
    }
    onSubmit(payload)
  }

  return (
    // docs/specs/092: two icon-tile sections in one form (Basic info, Branding and social) in place of the former
    // Branding / Social Media tabs. "(optional)" sits in the label and only validation errors show.
    <Box
      component="form"
      id={TEAM_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: hidden ? 'none' : 'flex', flexDirection: 'column', gap: 2, gridColumn: '1 / -1' }}
    >
      <FormSectionHeading icon={<InfoOutlinedIcon />} title="Basic info" />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        {sections && (
          <SectionTreeSelect
            label="Section"
            sections={sections}
            value={sectionId || null}
            onChange={(id) => setSectionId(id ?? '')}
            error={Boolean(errors.sectionId)}
            helperText={errors.sectionId}
          />
        )}

        <Input label="Name" value={name} onChange={handleNameChange} error={Boolean(errors.name)} helperText={errors.name} />

        <Input label="Abbreviation (optional)" value={abbreviation} onChange={handleAbbreviationChange} />

        <Input label="Ground (optional)" value={groundName} onChange={handleGroundNameChange} />
      </Box>

      <FormSectionHeading icon={<PaletteOutlinedIcon />} title="Branding and social" />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Box>
          <MediaUpload label="Logo (optional)" value={logoUrl} onUploaded={(url) => setLogoUrl(url)} variant="logo" namespace="manage" />

          {!logoUrl && clubLogoUrl && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
              <Avatar src={clubLogoUrl} variant="rounded" sx={{ width: 32, height: 32 }} />
              <Typography variant="caption" color="text.secondary">
                Using your club's logo — upload one above to override.
              </Typography>
            </Stack>
          )}

          {logoUrl && (
            <Button variant="ghost" size="sm" sx={{ mt: 1.5 }} onClick={() => setLogoUrl(null)}>
              Reset to club logo
            </Button>
          )}
        </Box>
        <SocialLinksFields value={socialLinks} onChange={setSocialLinks} />
      </Box>
    </Box>
  )
}
