import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Avatar,
  Box,
  Breadcrumbs,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Typography,
  Button as MuiButton,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { Input } from '../Input'
import { Button } from '../Button'
import { Card } from '../Card'
import type { ClubContact } from '../../api/clubContactApi'
import type { Section, SectionPayload } from '../../api/sectionApi'
import type { Team } from '../../api/teamApi'

// Identical to RecordCard's own 'muted' badge tone sx (docs/specs/027-team-profile.md) —
// SectionDetailPanel doesn't use RecordCard itself, so the values are copied rather than shared.
const MUTED_CHIP_SX = {
  bgcolor: (theme: Theme) => alpha(theme.palette.text.secondary, 0.12),
  color: 'text.secondary',
  opacity: 0.7,
} as const

export interface SectionDetailPanelProps {
  // Plumbed down from ClubStructure.tsx's existing Outlet-context value — needed to build the
  // "Manage Teams" cross-link's route below (docs/specs/026-teams.md).
  clubId: string
  section: Section
  // Ancestor names only, root-first — the parent (ClubStructure) computes this by walking
  // parentSectionId up the flat sections array. The current node's own name is rendered
  // separately, as the editable field below.
  breadcrumb: string[]
  onUpdate: (payload: Partial<SectionPayload>) => void
  contacts: ClubContact[]
  // The section's own teams (docs/specs/027-team-profile.md) — fetched by ClubStructure.tsx via
  // 026's existing listTeamsForSection, the same place contacts is already fetched for the
  // selected node. Rendered as badges on the "Manage Teams" card so an admin can see what's
  // already there without clicking through.
  teams: Team[]
  onLinkExisting: () => void
  onCreateAndLink: () => void
  onUnlink: (contactId: string) => void
  // Not one of the four props the plan named explicitly, but wired in since reactivateSection
  // already exists in sectionApi.ts and docs/specs/025-club-structure.md's Acceptance Criteria
  // requires a leaf node be reactivatable — the tree editor's own toolbar only ever offers
  // remove/rename on an *active* node, so this is the one place a reactivate action can live.
  onReactivate?: () => void
  // Bumped by ClubStructure every time the tree's own "Rename" toolbar button is clicked, so this
  // panel can focus its Name field in response — that button only ever appears on an already-
  // selected node, so selecting it again is a no-op; focusing the field it's meant to edit is the
  // actual "rename" affordance the design calls for. Any changing value works; a counter avoids
  // needing to reset it, unlike a boolean.
  focusNameSignal?: number
}

function initialsOf(contact: ClubContact): string {
  return `${contact.contact.firstName[0] ?? ''}${contact.contact.lastName[0] ?? ''}`.toUpperCase()
}

function numberToInput(value: number | null): string {
  return value === null ? '' : String(value)
}

function inputToNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

// The node detail panel — docs/specs/025-club-structure.md: breadcrumb trail, an editable name
// field, the three independently-optional eligibility fields, and the section's linked
// ClubContact records (link existing / create-and-link / unlink).
export function SectionDetailPanel({
  clubId,
  section,
  breadcrumb,
  onUpdate,
  contacts,
  teams,
  onLinkExisting,
  onCreateAndLink,
  onUnlink,
  onReactivate,
  focusNameSignal,
}: SectionDetailPanelProps) {
  const [name, setName] = useState(section.name)
  const [minAge, setMinAge] = useState(numberToInput(section.minAge))
  const [maxAge, setMaxAge] = useState(numberToInput(section.maxAge))
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Resets local draft state only when a *different* node is selected — not on every refetch of
  // the same node (e.g. after a successful onUpdate), which would otherwise clobber a value the
  // admin is still mid-edit on.
  useEffect(() => {
    setName(section.name)
    setMinAge(numberToInput(section.minAge))
    setMaxAge(numberToInput(section.maxAge))
  }, [section.id])

  // The tree's own "Rename" toolbar button only ever shows on an already-selected node, so
  // reselecting it is a no-op — this is the actual rename affordance: focus (and select the text
  // of) the Name field it's meant to edit. Skips the initial mount (signal starts undefined/0).
  useEffect(() => {
    if (focusNameSignal) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [focusNameSignal])

  const minAgeValue = inputToNumber(minAge)
  const maxAgeValue = inputToNumber(maxAge)
  const ageRangeError = minAgeValue != null && maxAgeValue != null && minAgeValue > maxAgeValue

  const commitName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== section.name) {
      onUpdate({ name: trimmed })
    } else {
      setName(section.name)
    }
  }

  const commitAgeRange = () => {
    if (ageRangeError) {
      return
    }
    if (minAgeValue !== section.minAge || maxAgeValue !== section.maxAge) {
      onUpdate({ minAge: minAgeValue, maxAge: maxAgeValue })
    }
  }

  const handleGenderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    onUpdate({ gender: value === '' ? null : (value as 'MALE' | 'FEMALE') })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {breadcrumb.length > 0 && (
        <Breadcrumbs separator="›" sx={{ fontSize: 13 }}>
          {breadcrumb.map((crumb) => (
            <Typography key={crumb} variant="caption" color="text.secondary">
              {crumb}
            </Typography>
          ))}
          <Typography variant="caption" fontWeight={600}>
            {section.name}
          </Typography>
        </Breadcrumbs>
      )}

      {!section.active && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.08),
          }}
        >
          <Typography variant="body2" color="text.secondary">
            This section is inactive.
          </Typography>
          {onReactivate && (
            <Button variant="secondary" size="sm" onClick={onReactivate}>
              Reactivate
            </Button>
          )}
        </Box>
      )}

      <Input
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        inputRef={nameInputRef}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <Input
          label="Minimum age"
          type="number"
          value={minAge}
          onChange={(event) => setMinAge(event.target.value)}
          onBlur={commitAgeRange}
          error={ageRangeError}
          helperText={ageRangeError ? 'Minimum age must not be greater than maximum age' : undefined}
        />
        <Input
          label="Maximum age"
          type="number"
          value={maxAge}
          onChange={(event) => setMaxAge(event.target.value)}
          onBlur={commitAgeRange}
          error={ageRangeError}
        />
        <Input
          label="Gender"
          select
          value={section.gender ?? ''}
          onChange={handleGenderChange}
          sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
        >
          <MenuItem value="">Not specified</MenuItem>
          <MenuItem value="MALE">Male</MenuItem>
          <MenuItem value="FEMALE">Female</MenuItem>
        </Input>
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Linked contacts
        </Typography>

        {contacts.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No contacts linked to this section yet.
          </Typography>
        )}

        {contacts.length > 0 && (
          <Stack spacing={1}>
            {contacts.map((contact) => (
              <Stack key={contact.id} direction="row" alignItems="center" spacing={1.5}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                    color: 'primary.dark',
                  }}
                >
                  {initialsOf(contact)}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {contact.contact.firstName} {contact.contact.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {contact.role}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={`Unlink ${contact.contact.firstName} ${contact.contact.lastName}`}
                  onClick={() => onUnlink(contact.id)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="secondary" size="sm" onClick={onLinkExisting}>
            Link existing
          </Button>
          <Button variant="ghost" size="sm" onClick={onCreateAndLink}>
            + New contact
          </Button>
        </Stack>
      </Box>

      {/* docs/specs/026-teams.md: "Manage Teams" entry point for the Teams that live directly
          under this section — shown for any selected node, active or not, leaf or not (see the
          spec's Non-goal on leaf enforcement). A real bordered Card + icon + outlined button, not
          a bare text link — copies SponsorFormPage.tsx's exact "Manage Contacts" cross-link
          pattern, established after a first version used a small `variant="text"` link here and
          it was genuinely hard to spot against the rest of the page (real user feedback). clubId
          is plumbed through from ClubStructure.tsx's Outlet context and stamped onto the card so
          this cross-link's club scope is visible/assertable even though it isn't itself part of
          the target route (the destination screen resolves clubId from its own Outlet context). */}
      <Card
        data-club-id={clubId}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          p: 2,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ minWidth: 0 }}>
          <GroupsOutlinedIcon color="action" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" component="h2">
              Teams
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage the named teams that sit directly under this section.
            </Typography>

            {teams.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                No teams yet
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {teams.map((team) => (
                  <Chip
                    key={team.id}
                    label={team.name}
                    size="small"
                    sx={team.active ? undefined : MUTED_CHIP_SX}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
        {/* Raw MuiButton, not the shared Button wrapper — Button isn't typed as a polymorphic MUI
            component (no generic `component` prop support), so `component`+`to` together fail
            tsc's real project build (tsc -b) even though a plain `tsc --noEmit` run misses it
            locally. variant/color/size below match Button's variant="secondary". */}
        <MuiButton
          component={RouterLink}
          to={`/manage/sections/${section.id}/teams`}
          variant="outlined"
          color="primary"
          size="small"
        >
          Manage Teams
        </MuiButton>
      </Card>
    </Box>
  )
}
