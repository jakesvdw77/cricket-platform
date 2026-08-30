import { useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SectionTreeEditor } from '../../components/SectionTreeEditor'
import { SectionDetailPanel } from '../../components/SectionDetailPanel'
import { SectionTemplatePicker } from '../../components/SectionTemplatePicker'
import type { SectionTemplate, SectionTemplateNode } from '../../components/SectionTemplatePicker'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
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

// A few genuinely different, real club/school shapes — not one hardcoded default — per direct
// user feedback on docs/specs/025-club-structure.md (see its User Stories and Rollout Notes for
// the reasoning). Pure convenience data built via ordinary createSection calls, not a special
// server-side endpoint — the admin can rename, delete, or restructure every node any of these
// create, exactly as if they'd built it by hand.
const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: 'traditional',
    title: 'Traditional club',
    description: "Men's and women's open sides, boys' and girls' junior age-groups, and a vets section.",
    roots: [
      {
        name: 'Open Sides',
        children: [
          { name: 'Men', children: [{ name: '1st XI' }, { name: '2nd XI' }] },
          { name: 'Women', children: [{ name: '1st XI' }] },
        ],
      },
      {
        name: 'Juniors',
        children: [
          { name: 'Boys', children: [{ name: 'U11' }, { name: 'U13' }, { name: 'U15' }] },
          { name: 'Girls', children: [{ name: 'U13' }, { name: 'U15' }] },
        ],
      },
      { name: 'Vets', children: [{ name: 'Over 40' }, { name: 'Over 50' }] },
    ],
  },
  {
    id: 'simple',
    title: 'Simple club',
    description: 'One open-age set of teams and one junior age-ladder — no gender split.',
    roots: [
      { name: 'Open Sides', children: [{ name: '1st XI' }, { name: '2nd XI' }, { name: '3rd XI' }] },
      { name: 'Juniors', children: [{ name: 'U11' }, { name: 'U13' }, { name: 'U15' }, { name: 'U17' }] },
    ],
  },
  {
    id: 'adults-only',
    title: 'Adults only',
    description: "No junior section — just open-age and veterans' cricket.",
    roots: [
      { name: 'Open Sides', children: [{ name: '1st XI' }, { name: '2nd XI' }] },
      { name: 'Vets', children: [{ name: 'Over 40' }, { name: 'Over 50' }] },
    ],
  },
  {
    id: 'school',
    title: 'School',
    description: 'First and Second XI, plus an age-graded Colts ladder — the shape most schools use.',
    roots: [
      { name: 'First XI' },
      { name: 'Second XI' },
      { name: 'Colts', children: [{ name: 'U14' }, { name: 'U15' }, { name: 'U16' }, { name: 'U19' }] },
    ],
  },
]

const BLANK_PAYLOAD: Omit<SectionPayload, 'name' | 'parentSectionId'> = {
  minAge: null,
  maxAge: null,
  gender: null,
}

async function createTemplateNode(clubId: string, node: SectionTemplateNode, parentId: string | null): Promise<void> {
  const created = await createSection(clubId, { name: node.name, parentSectionId: parentId, ...BLANK_PAYLOAD })
  for (const child of node.children ?? []) {
    await createTemplateNode(clubId, child, created.id)
  }
}

async function buildFromTemplate(clubId: string, template: SectionTemplate): Promise<void> {
  for (const root of template.roots) {
    await createTemplateNode(clubId, root, null)
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
  // Bumped on every click of the tree's "Rename" toolbar button (which only ever shows on an
  // already-selected node, so reselecting it is a no-op) — SectionDetailPanel watches this to
  // focus its Name field, the field that button is actually meant to hand control to.
  const [renameSignal, setRenameSignal] = useState(0)
  // The detail card can be manually collapsed, but selecting a node always reopens it — the
  // point of collapsing is to reclaim space while browsing the tree, not to hide the panel from
  // a selection the admin just made. Starts collapsed (nothing is selected yet on first load),
  // and the effect below re-collapses it any time the selection is cleared — by the Clear
  // action, or by deactivateMutation's own null result when a removed section is hard-deleted
  // out from under the current selection — rather than leaving an empty "Select a section"
  // placeholder sitting open at full width for no reason.
  const [detailCollapsed, setDetailCollapsed] = useState(true)
  const [skipTemplateChoice, setSkipTemplateChoice] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    if (selectedId === null) {
      setDetailCollapsed(true)
    }
  }, [selectedId])

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
    mutationFn: (template: SectionTemplate) => buildFromTemplate(clubId as string, template),
    onSuccess: invalidateSections,
  })

  const createMutation = useMutation({
    mutationFn: (payload: SectionPayload) => createSection(clubId as string, payload),
    onSuccess: (created) => {
      invalidateSections()
      setSelectedId(created.id)
      setDetailCollapsed(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ sectionId, payload }: { sectionId: string; payload: SectionPayload }) =>
      updateSection(clubId as string, sectionId, payload),
    onSuccess: invalidateSections,
  })

  const deactivateMutation = useMutation({
    mutationFn: (sectionId: string) => deactivateSection(clubId as string, sectionId),
    onSuccess: (result, sectionId) => {
      invalidateSections()
      // `null` means the section had nothing attached to it and was actually deleted server-side
      // (see sectionApi.ts) rather than soft-deactivated — clear the selection so the detail
      // panel doesn't keep pointing at a row that no longer exists.
      if (result === null && selectedId === sectionId) {
        setSelectedId(null)
      }
    },
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
      <ManageScreenHeader title="Club Structure" />

      {deactivateMutation.isError && (
        <Typography variant="body2" color="error.main">
          {errorDetail(deactivateMutation.error, "Couldn't remove this section. Please try again.")}
        </Typography>
      )}

      {showTemplateChoice ? (
        <SectionTemplatePicker
          templates={SECTION_TEMPLATES}
          onChoose={(template) => templateMutation.mutate(template)}
          onStartBlank={() => setSkipTemplateChoice(true)}
          pendingTemplateId={templateMutation.isPending ? templateMutation.variables?.id : null}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}>
          <Card
            sx={{
              // On desktop, collapsing the detail panel reclaims its width for the tree (not its
              // height — both cards always stay full height, see below) so there's more room to
              // see the structure, per direct feedback that a vertical-only collapse hid the
              // structure instead of revealing more of it. flex: '1 1 auto' here means "take
              // whatever the detail panel's fixed-width rail doesn't."
              flex: { xs: '1 1 auto', md: detailCollapsed ? '1 1 auto' : '1 1 60%' },
              width: { xs: '100%', md: 'auto' },
              alignSelf: 'stretch',
              display: 'flex',
              flexDirection: 'column',
              minHeight: { md: 560 },
            }}
            contentSx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <SectionTreeEditor
              sections={sections}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id)
                setDetailCollapsed(false)
              }}
              onAddChild={handleAddChild}
              onRemove={(id) => deactivateMutation.mutate(id)}
              onRenameStart={(id) => {
                setSelectedId(id)
                setDetailCollapsed(false)
                setRenameSignal((n) => n + 1)
              }}
            />
          </Card>

          <Card
            sx={{
              // Collapsed (desktop only): a fixed-width rail, not a fixed-height header bar —
              // flex-basis (not width) drives sizing here since it wins over width in a flex row;
              // width stays 'auto' so it never fights flex-basis (a real bug caught earlier this
              // session came from exactly that conflict). Both states keep alignSelf: 'stretch' +
              // the same minHeight as the tree card — collapsing never hides the structure by
              // shrinking height, only reclaims width when there's nothing to show.
              flex: { xs: '1 1 auto', md: detailCollapsed ? '0 0 56px' : '1 1 40%' },
              width: { xs: '100%', md: 'auto' },
              alignSelf: 'stretch',
              display: 'flex',
              flexDirection: 'column',
              minHeight: { md: 560 },
              overflow: 'hidden',
            }}
            contentSx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
          >
            {/* Desktop-collapsed: a narrow rail with just an expand affordance. Never shown on
                mobile — there, collapsing still means "hide the body, keep the header," since a
                stacked layout has no spare width to reclaim in the first place. */}
            {detailCollapsed && (
              <Box
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  flexDirection: 'column',
                  alignItems: 'center',
                  pt: 2,
                  flex: 1,
                }}
              >
                <IconButton size="small" aria-label="Expand section details" onClick={() => setDetailCollapsed(false)}>
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
              </Box>
            )}

            <Box
              sx={{
                display: { xs: 'flex', md: detailCollapsed ? 'none' : 'flex' },
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                p: 2,
                flex: '0 0 auto',
                ...(detailCollapsed ? {} : { borderBottom: 1, borderColor: 'divider' }),
              }}
            >
              <Typography variant="subtitle2" fontWeight={600}>
                Section details
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {selectedId && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                    Clear
                  </Button>
                )}
                <IconButton
                  size="small"
                  aria-label={detailCollapsed ? 'Expand section details' : 'Collapse section details'}
                  onClick={() => setDetailCollapsed((collapsed) => !collapsed)}
                >
                  {/* Left/right, not up/down — collapsing this panel shrinks it horizontally
                      (see the rail below), so the chevron should point the way the edge actually
                      moves. Matches the collapsed rail's own ChevronLeftIcon for "expand". */}
                  {detailCollapsed ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
              </Stack>
            </Box>

            {!detailCollapsed && (
              <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
                {selectedSection ? (
                  <SectionDetailPanel
                    section={selectedSection}
                    breadcrumb={breadcrumbFor(selectedSection, sectionsById)}
                    onUpdate={handleUpdate}
                    contacts={contactsLoading ? [] : (contacts ?? [])}
                    onLinkExisting={() => setLinkDialogOpen(true)}
                    onCreateAndLink={() => setCreateDialogOpen(true)}
                    onUnlink={(contactId) => unlinkMutation.mutate(contactId)}
                    focusNameSignal={renameSignal}
                    onReactivate={
                      selectedSection.active ? undefined : () => reactivateMutation.mutate(selectedSection.id)
                    }
                  />
                ) : (
                  <EmptyState title="Select a section" description="Click a node in the tree to view and edit it." />
                )}
              </Box>
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
