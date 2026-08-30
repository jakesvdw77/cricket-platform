import { useMemo, useState } from 'react'
import {
  Autocomplete,
  Box,
  Button as MuiButton,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SectionTreeEditor } from '../../components/SectionTreeEditor'
import { SectionDetailPanel } from '../../components/SectionDetailPanel'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { EmptyState } from '../../components/EmptyState'
import { ClubContactForm, CLUB_CONTACT_FORM_ID } from '../../components/ClubContactForm'
import {
  createSection,
  deactivateSection,
  linkSectionContact,
  listSectionContacts,
  listSections,
  reactivateSection,
  unlinkSectionContact,
  updateSection,
} from '../../api/sectionApi'
import type { Section, SectionPayload } from '../../api/sectionApi'
import { createClubContact, listClubContacts } from '../../api/clubContactApi'
import type { ClubContact, ClubContactPayload } from '../../api/clubContactApi'
import { errorDetail } from '../../utils/errorDetail'

// A small, plausible starting shape (Goals section of docs/specs/025-club-structure.md) — pure
// convenience data built via ordinary createSection calls, not a special server-side endpoint.
// The admin can rename, delete, or restructure every node it creates.
const STARTER_TEMPLATE: { name: string; children: string[] }[] = [
  { name: 'Open Sides', children: ['1st XI', '2nd XI'] },
  { name: 'Juniors', children: ['U13', 'U15'] },
  { name: 'Vets', children: ['Over 40', 'Over 50'] },
]

const BLANK_PAYLOAD: Omit<SectionPayload, 'name' | 'parentSectionId'> = {
  minAge: null,
  maxAge: null,
  gender: null,
}

async function buildStarterTemplate(clubId: string): Promise<void> {
  for (const group of STARTER_TEMPLATE) {
    const parent = await createSection(clubId, { name: group.name, parentSectionId: null, ...BLANK_PAYLOAD })
    for (const childName of group.children) {
      await createSection(clubId, { name: childName, parentSectionId: parent.id, ...BLANK_PAYLOAD })
    }
  }
}

// Walks parentSectionId up the flat list to build a root-first ancestor name trail for the
// breadcrumb — SectionDetailPanel just renders whatever's handed to it.
function breadcrumbFor(section: Section, sectionsById: Map<string, Section>): string[] {
  const trail: string[] = []
  let current = section.parentSectionId ? sectionsById.get(section.parentSectionId) : undefined
  while (current) {
    trail.unshift(current.name)
    current = current.parentSectionId ? sectionsById.get(current.parentSectionId) : undefined
  }
  return trail
}

const SECTIONS_QUERY_KEY = (clubId?: string) => ['managed-club', clubId, 'sections']
const SECTION_CONTACTS_QUERY_KEY = (clubId?: string, sectionId?: string | null) => [
  'managed-club',
  clubId,
  'sections',
  sectionId,
  'contacts',
]

// Reads clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same
// guard pattern as ManageClubProfilePage.tsx/ClubContactList.tsx. Rewritten from 006's EmptyState
// placeholder — see docs/specs/025-club-structure.md.
export default function ClubStructure() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [skipTemplateChoice, setSkipTemplateChoice] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const {
    data: sections,
    isLoading,
    isError,
  } = useQuery({
    queryKey: SECTIONS_QUERY_KEY(clubId),
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(sections ?? []).forEach((section) => map.set(section.id, section))
    return map
  }, [sections])

  const selectedSection = selectedId ? sectionsById.get(selectedId) ?? null : null

  const {
    data: contacts,
    isFetching: contactsLoading,
  } = useQuery({
    queryKey: SECTION_CONTACTS_QUERY_KEY(clubId, selectedId),
    queryFn: () => listSectionContacts(clubId as string, selectedId as string),
    enabled: Boolean(clubId) && Boolean(selectedId),
  })

  const allContactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'contacts'],
    queryFn: () => listClubContacts(clubId as string),
    enabled: Boolean(clubId) && (linkDialogOpen || createDialogOpen),
  })

  const invalidateSections = () => queryClient.invalidateQueries({ queryKey: SECTIONS_QUERY_KEY(clubId) })
  const invalidateContacts = (sectionId: string | null) =>
    queryClient.invalidateQueries({ queryKey: SECTION_CONTACTS_QUERY_KEY(clubId, sectionId) })

  const templateMutation = useMutation({
    mutationFn: () => buildStarterTemplate(clubId as string),
    onSuccess: invalidateSections,
  })

  const createMutation = useMutation({
    mutationFn: (payload: SectionPayload) => createSection(clubId as string, payload),
    onSuccess: (created) => {
      invalidateSections()
      setSelectedId(created.id)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ sectionId, payload }: { sectionId: string; payload: SectionPayload }) =>
      updateSection(clubId as string, sectionId, payload),
    onSuccess: invalidateSections,
  })

  const deactivateMutation = useMutation({
    mutationFn: (sectionId: string) => deactivateSection(clubId as string, sectionId),
    onSuccess: invalidateSections,
  })

  const reactivateMutation = useMutation({
    mutationFn: (sectionId: string) => reactivateSection(clubId as string, sectionId),
    onSuccess: invalidateSections,
  })

  const linkMutation = useMutation({
    mutationFn: (contactId: string) => linkSectionContact(clubId as string, selectedId as string, contactId),
    onSuccess: () => {
      invalidateContacts(selectedId)
      setLinkDialogOpen(false)
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (contactId: string) => unlinkSectionContact(clubId as string, selectedId as string, contactId),
    onSuccess: () => invalidateContacts(selectedId),
  })

  const createAndLinkMutation = useMutation({
    mutationFn: async (payload: ClubContactPayload) => {
      const contact = await createClubContact(clubId as string, payload)
      await linkSectionContact(clubId as string, selectedId as string, contact.id)
      return contact
    },
    onSuccess: () => {
      invalidateContacts(selectedId)
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'contacts'] })
      setCreateDialogOpen(false)
    },
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !sections) {
    return (
      <EmptyState
        title="Couldn't load your club structure"
        description="Something went wrong loading your club's sections. Please try again."
      />
    )
  }

  const handleAddChild = (parentId: string | null) => {
    createMutation.mutate({ name: 'New section', parentSectionId: parentId, ...BLANK_PAYLOAD })
  }

  const handleUpdate = (payload: Partial<SectionPayload>) => {
    if (!selectedSection) {
      return
    }
    const merged: SectionPayload = {
      name: payload.name ?? selectedSection.name,
      minAge: 'minAge' in payload ? (payload.minAge ?? null) : selectedSection.minAge,
      maxAge: 'maxAge' in payload ? (payload.maxAge ?? null) : selectedSection.maxAge,
      gender: 'gender' in payload ? (payload.gender ?? null) : selectedSection.gender,
    }
    updateMutation.mutate({ sectionId: selectedSection.id, payload: merged })
  }

  const alreadyLinkedIds = new Set((contacts ?? []).map((contact) => contact.id))
  const linkableContacts: ClubContact[] = (allContactsQuery.data ?? []).filter(
    (contact) => !alreadyLinkedIds.has(contact.id),
  )

  const showTemplateChoice = sections.length === 0 && !skipTemplateChoice

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Same bare-list-screen back link ClubContactList.tsx already established — no shared
          component for it yet (see that file's own comment). */}
      <MuiButton
        component={RouterLink}
        to="/manage"
        variant="text"
        color="inherit"
        size="small"
        startIcon={<ArrowBackIcon fontSize="small" />}
        sx={{ alignSelf: 'flex-start', ml: -1, color: 'text.secondary' }}
      >
        Back to Dashboard
      </MuiButton>

      <Typography variant="h6" fontWeight={600}>
        Club Structure
      </Typography>

      {deactivateMutation.isError && (
        <Typography variant="body2" color="error.main">
          {errorDetail(deactivateMutation.error, "Couldn't remove this section. Please try again.")}
        </Typography>
      )}

      {showTemplateChoice ? (
        <EmptyState
          title="Build your club's section tree"
          description="Start from a small template you can freely rename, restructure, or prune — or start blank and build it yourself."
          action={
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button onClick={() => templateMutation.mutate()} disabled={templateMutation.isPending}>
                {templateMutation.isPending ? 'Building…' : 'Start from a template'}
              </Button>
              <Button variant="secondary" onClick={() => setSkipTemplateChoice(true)}>
                Start blank
              </Button>
            </Stack>
          }
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'flex-start' }}>
          <Card sx={{ flex: { xs: '1 1 auto', md: '1 1 60%' }, width: '100%' }}>
            <SectionTreeEditor
              sections={sections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAddChild={handleAddChild}
              onRemove={(id) => deactivateMutation.mutate(id)}
              onRenameStart={setSelectedId}
            />
          </Card>

          <Card sx={{ flex: { xs: '1 1 auto', md: '1 1 40%' }, width: '100%' }}>
            {selectedSection ? (
              <SectionDetailPanel
                section={selectedSection}
                breadcrumb={breadcrumbFor(selectedSection, sectionsById)}
                onUpdate={handleUpdate}
                contacts={contactsLoading ? [] : (contacts ?? [])}
                onLinkExisting={() => setLinkDialogOpen(true)}
                onCreateAndLink={() => setCreateDialogOpen(true)}
                onUnlink={(contactId) => unlinkMutation.mutate(contactId)}
                onReactivate={
                  selectedSection.active ? undefined : () => reactivateMutation.mutate(selectedSection.id)
                }
              />
            ) : (
              <EmptyState title="Select a section" description="Click a node in the tree to view and edit it." />
            )}
          </Card>
        </Box>
      )}

      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Link an existing contact</DialogTitle>
        <DialogContent>
          <Autocomplete<ClubContact>
            options={linkableContacts}
            loading={allContactsQuery.isFetching}
            getOptionLabel={(option) => `${option.contact.firstName} ${option.contact.lastName} — ${option.role}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_event, value) => {
              if (value) {
                linkMutation.mutate(value.id)
              }
            }}
            renderInput={(params) => (
              <Input
                {...params}
                label="Search contacts"
                placeholder="Search by name or role"
                sx={{ mt: 1 }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {allContactsQuery.isFetching && <CircularProgress color="inherit" size={16} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={() => setLinkDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New contact</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, pt: 1 }}>
            <ClubContactForm onSubmit={(payload) => createAndLinkMutation.mutate(payload)} />
          </Box>
          {createAndLinkMutation.isError && (
            <Typography variant="body2" color="error.main" sx={{ mt: 2 }}>
              {errorDetail(createAndLinkMutation.error, "Couldn't create and link this contact. Please try again.")}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form={CLUB_CONTACT_FORM_ID} disabled={createAndLinkMutation.isPending}>
            {createAndLinkMutation.isPending ? 'Creating…' : 'Create & link'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
