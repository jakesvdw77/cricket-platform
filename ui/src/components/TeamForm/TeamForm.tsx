import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Avatar, Box, Stack, Typography } from '@mui/material'
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
  // LeagueForm. Direct user feedback afterward found the nested Basic Info/Branding/Social Media
  // inner-Tabs this component originally rendered confusing on top of TeamFormPage's own outer
  // tabs — Branding and Social Media are now TeamFormPage's own top-level tabs instead (see its
  // `activeSection`/`hidden` props below), not a bar this component renders itself.
  abbreviation?: string | null
  groundName?: string | null
  socialLinks?: SocialLink[]
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
  // Which of this form's three field-groups TeamFormPage's own outer Tabs is currently showing —
  // this component keeps owning ALL of its state (name/sectionId/logoUrl/abbreviation/groundName/
  // socialLinks) in one always-mounted instance regardless of which section is visible, so
  // switching TeamFormPage's tabs never loses unsaved edits the way separately-mounted instances
  // would. Replaces this component's own former internal activeTab state entirely.
  activeSection: 'details' | 'branding' | 'social'
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

export function TeamForm({ initialValues, onSubmit, sections, clubLogoUrl, activeSection, hidden, onInvalid }: TeamFormProps) {
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
    <Box
      component="form"
      id={TEAM_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      sx={{
        display: hidden ? 'none' : 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 3,
        gridColumn: '1 / -1',
      }}
    >
      {activeSection === 'details' && (
        <>
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

          <Input
            label="Name"
            value={name}
            onChange={handleNameChange}
            error={Boolean(errors.name)}
            helperText={errors.name ?? 'e.g. 1st XI'}
          />

          <Input
            label="Abbreviation"
            value={abbreviation}
            onChange={handleAbbreviationChange}
            helperText="Purely descriptive — e.g. ICL"
          />

          <Input
            label="Ground"
            value={groundName}
            onChange={handleGroundNameChange}
            helperText="e.g. Irene Country Club"
          />
        </>
      )}

      {activeSection === 'branding' && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <MediaUpload label="Logo" value={logoUrl} onUploaded={(url) => setLogoUrl(url)} variant="logo" namespace="manage" />

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
      )}

      {activeSection === 'social' && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <SocialLinksFields value={socialLinks} onChange={setSocialLinks} />
        </Box>
      )}
    </Box>
  )
}
