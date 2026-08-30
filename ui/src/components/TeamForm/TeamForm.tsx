import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Avatar, Box, MenuItem, Stack, Typography } from '@mui/material'
import { Input } from '../Input'
import { Button } from '../Button'
import { MediaUpload } from '../MediaUpload'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see TeamFormPage), so its Save button targets this form via the native HTML
// `form="…"` attribute, same pattern as CLUB_CONTACT_FORM_ID/SPONSOR_FORM_ID.
export const TEAM_FORM_ID = 'team-form'

export interface TeamFormSection {
  id: string
  name: string
}

export interface TeamFormValues {
  name: string
  sectionId?: string
  // Nullable — same posture as Sponsor/ClubProfile's own logoUrl fields. Captured on both create
  // and edit (docs/specs/027-team-profile.md), unlike the contacts/sponsors sections which only
  // ever render in edit mode.
  logoUrl?: string | null
}

export interface TeamFormProps {
  initialValues?: Partial<TeamFormValues>
  onSubmit: (payload: TeamFormValues) => void
  // Optional — when supplied, a required Section picker renders above the name field (the
  // club-wide directory's create flow, where the team's section hasn't been chosen yet). When
  // omitted, no section field renders at all (the section-scoped create/edit flow, where the
  // section is already fixed by the route — editing never exposes a section field, see
  // docs/specs/026-teams.md's re-parenting Non-goal). One component, two modes.
  sections?: TeamFormSection[]
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

export function TeamForm({ initialValues, onSubmit, sections, clubLogoUrl }: TeamFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [sectionId, setSectionId] = useState(initialValues?.sectionId ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(initialValues?.logoUrl ?? null)
  const [errors, setErrors] = useState<FormErrors>({})

  const requireSection = Boolean(sections)

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
  }

  const handleSectionChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSectionId(event.target.value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(name, sectionId, requireSection)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: TeamFormValues = {
      name: name.trim(),
      ...(requireSection ? { sectionId } : {}),
      logoUrl,
    }
    onSubmit(payload)
  }

  return (
    // display: 'contents' removes this <form> from the box tree so its children become direct
    // items of RecordFormScreen's field grid (see TeamFormPage) — same pattern as
    // ClubContactForm/SponsorForm's *_FORM_ID.
    <Box component="form" id={TEAM_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      {sections && (
        <Input
          select
          label="Section"
          value={sectionId}
          onChange={handleSectionChange}
          error={Boolean(errors.sectionId)}
          helperText={errors.sectionId}
        >
          {sections.map((section) => (
            <MenuItem key={section.id} value={section.id}>
              {section.name}
            </MenuItem>
          ))}
        </Input>
      )}

      <Input
        label="Name"
        value={name}
        onChange={handleNameChange}
        error={Boolean(errors.name)}
        helperText={errors.name ?? 'e.g. 1st XI'}
      />

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
    </Box>
  )
}
