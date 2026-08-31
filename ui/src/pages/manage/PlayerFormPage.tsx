import { useMemo, useState } from 'react'
import { Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlayerForm, PLAYER_FORM_ID } from '../../components/PlayerForm'
import type { PlayerFormValues } from '../../components/PlayerForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SectionTree } from '../../components/SectionTree'
import {
  listPlayers,
  createPlayer,
  updatePlayer,
  listPlayerSections,
  linkPlayerSection,
  unlinkPlayerSection,
} from '../../api/playerApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { errorDetail } from '../../utils/errorDetail'

// clubId comes from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same as
// every other /manage form page; the player id is a route param (:playerId?), matching
// ClubContactFormPage/TeamFormPage's create/edit-via-optional-param shape. There's no
// single-player GET endpoint (only list/create/update/deactivate/reactivate, per
// docs/specs/028-players.md's API Contract) — edit mode fetches the full (small, unpaginated)
// list and finds the matching row client-side rather than adding a new backend endpoint.
//
// A real, already-confirmed decision this session: this page owns ONE flat 4-tab bar (Basic Info
// | Contact Info | Cricket Info | Sections), mirroring TeamFormPage's Details/Contacts/Sponsors
// pattern exactly — PlayerForm itself does not own Tabs, it just renders whichever of the first
// three panels activeTab selects. Sections (tab 3) only ever renders in edit mode — needs a
// persisted player id this page doesn't have until the player has been created once, same
// constraint 026/027 already established for Team's own Contacts/Sponsors tabs.
export default function PlayerFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { playerId } = useParams<{ playerId?: string }>()
  const isEdit = Boolean(playerId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<0 | 1 | 2 | 3>(0)
  const [sectionLinkOpen, setSectionLinkOpen] = useState(false)

  const {
    data: player,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'players'],
    queryFn: () => listPlayers(clubId as string),
    enabled: Boolean(clubId) && isEdit,
    select: (players) => players.find((candidate) => candidate.id === playerId),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: PlayerFormValues) => {
      if (isEdit && playerId) {
        return updatePlayer(clubId as string, playerId, payload)
      }
      return createPlayer(clubId as string, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'players'] })
      navigate('/manage/players')
    },
  })

  // --- Sections (docs/specs/028-players.md), edit mode only ---

  const playerSectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'players', playerId, 'sections'],
    queryFn: () => listPlayerSections(clubId as string, playerId as string),
    enabled: Boolean(clubId) && Boolean(playerId) && isEdit,
  })

  // Always fetched in edit mode (not just while the dialog is open) — same posture
  // TeamFormPage's own clubSponsorsQuery takes, since the candidate pool needs to be ready the
  // instant the dialog opens.
  const clubSectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId) && isEdit,
  })

  const invalidatePlayerSections = () =>
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'players', playerId, 'sections'] })

  const linkSectionMutation = useMutation({
    mutationFn: (sectionId: string) => linkPlayerSection(clubId as string, playerId as string, sectionId),
    onSuccess: () => {
      invalidatePlayerSections()
      setSectionLinkOpen(false)
    },
  })

  const unlinkSectionMutation = useMutation({
    mutationFn: (sectionId: string) => unlinkPlayerSection(clubId as string, playerId as string, sectionId),
    onSuccess: invalidatePlayerSections,
  })

  const alreadyTaggedSectionIds = new Set((playerSectionsQuery.data ?? []).map((section) => section.id))

  // Used both to disable already-tagged nodes in the tree picker (without removing them — a
  // removed node would orphan its children visually) and to show each tagged Chip's full
  // ancestor path, not just its bare leaf name — same ambiguity SectionTree/SectionTreeSelect
  // exist to fix in the picker itself, real user feedback on the original flat Autocomplete here.
  const clubSectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(clubSectionsQuery.data ?? []).forEach((section) => map.set(section.id, section))
    return map
  }, [clubSectionsQuery.data])

  function sectionPath(section: Section): string {
    return [...breadcrumbFor(section, clubSectionsById), section.name].join(' › ')
  }

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isEdit && isLoading) {
    return null
  }

  if (isEdit && (isError || !player)) {
    return (
      <EmptyState
        title="Couldn't load this player"
        description="Something went wrong loading this player. Please try again."
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <RecordFormScreen
        title={isEdit ? 'Edit Player' : 'Add Player'}
        backTo="/manage/players"
        backLabel="Back to Players"
        actions={
          activeTab !== 3 ? (
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              {saveMutation.isError && (
                <Typography variant="body2" color="error.main">
                  {errorDetail(saveMutation.error, 'Something went wrong saving this player. Please try again.')}
                </Typography>
              )}

              <Button type="submit" form={PLAYER_FORM_ID} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create player'}
              </Button>
            </Stack>
          ) : null
        }
      >
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Tabs
            value={activeTab}
            onChange={(_event, next: number) => setActiveTab(next as 0 | 1 | 2 | 3)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            <Tab label="Basic Info" />
            <Tab label="Contact Info" />
            <Tab label="Cricket Info" />
            {isEdit && <Tab label="Sections" />}
          </Tabs>
        </Box>

        {activeTab !== 3 && (
          <PlayerForm
            activeTab={activeTab}
            initialValues={
              player
                ? {
                    firstName: player.firstName,
                    lastName: player.lastName,
                    dateOfBirth: player.dateOfBirth,
                    gender: player.gender,
                    photoUrl: player.photoUrl,
                    clubMembershipNumber: player.clubMembershipNumber,
                    medicalAidProvider: player.medicalAidProvider,
                    medicalAidMemberNumber: player.medicalAidMemberNumber,
                    phone: player.phone,
                    email: player.email,
                    altContactName: player.altContactName,
                    altContactPhone: player.altContactPhone,
                    battingStance: player.battingStance,
                    bowlingArm: player.bowlingArm,
                    bowlingType: player.bowlingType,
                    isWicketKeeper: player.isWicketKeeper,
                  }
                : undefined
            }
            onSubmit={(payload) => saveMutation.mutate(payload)}
          />
        )}

        {isEdit && activeTab === 3 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Tagged sections
            </Typography>

            {(playerSectionsQuery.data ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Not tagged to any sections yet.
              </Typography>
            )}

            {(playerSectionsQuery.data ?? []).length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                {(playerSectionsQuery.data ?? []).map((section) => (
                  <Chip
                    key={section.id}
                    label={sectionPath(section)}
                    onDelete={() => unlinkSectionMutation.mutate(section.id)}
                  />
                ))}
              </Stack>
            )}

            <Button variant="secondary" size="sm" onClick={() => setSectionLinkOpen(true)}>
              Link existing
            </Button>
          </Box>
        )}
      </RecordFormScreen>

      {isEdit && (
        <Dialog open={sectionLinkOpen} onClose={() => setSectionLinkOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Tag this player to a section</DialogTitle>
          <DialogContent>
            {/* A real tree, not a flat search list — a flat Autocomplete here was genuinely
                ambiguous once two branches reused the same leaf name (e.g. "U13" under both Boys
                and Girls), real user feedback on the first version of this dialog. Already-tagged
                sections render disabled rather than being filtered out, so the tree's real shape
                stays intact. */}
            <SectionTree
              sections={clubSectionsQuery.data ?? []}
              disabledIds={alreadyTaggedSectionIds}
              onSelect={(sectionId) => linkSectionMutation.mutate(sectionId)}
              emptyMessage="This club has no sections yet."
            />
          </DialogContent>
          <DialogActions>
            <Button variant="ghost" onClick={() => setSectionLinkOpen(false)}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}
