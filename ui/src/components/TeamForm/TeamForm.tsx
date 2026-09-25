import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Avatar, Box, Stack, Tab, Tabs, Typography } from '@mui/material'
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
  // LeagueForm — including its Basic Info/Branding/Social Media inner-Tabs shape, per direct user
  // feedback that Social Media should be a tab here too, matching every other form in this
  // codebase that has one, rather than a flat field at the bottom.
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

export function TeamForm({ initialValues, onSubmit, sections, clubLogoUrl }: TeamFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [sectionId, setSectionId] = useState(initialValues?.sectionId ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(initialValues?.logoUrl ?? null)
  const [abbreviation, setAbbreviation] = useState(initialValues?.abbreviation ?? '')
  const [groundName, setGroundName] = useState(initialValues?.groundName ?? '')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(initialValues?.socialLinks ?? [])
  const [errors, setErrors] = useState<FormErrors>({})
  const [activeTab, setActiveTab] = useState(0)

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
      // Both validated fields (name, sectionId) live on the Basic Info tab — same
      // switch-to-the-tab-with-the-error pattern SponsorForm/LeagueForm already use.
      setActiveTab(0)
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
        id={TEAM_FORM_ID}
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}
      >
        {activeTab === 0 && (
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

        {activeTab === 1 && (
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

        {activeTab === 2 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <SocialLinksFields value={socialLinks} onChange={setSocialLinks} />
          </Box>
        )}
      </Box>
    </Box>
  )
}
