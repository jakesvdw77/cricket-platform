import { useEffect, useMemo, useState } from 'react'
import { Box, Breadcrumbs, Divider, MenuItem, Stack, Tab, Tabs, Typography } from '@mui/material'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TeamForm, TEAM_FORM_ID } from '../../components/TeamForm'
import type { TeamFormValues } from '../../components/TeamForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { RecordCard } from '../../components/RecordCard'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { RecordStatusToggle } from '../../components/RecordStatusToggle'
import { EmptyState } from '../../components/EmptyState'
import { LinkExistingRecordDialog } from '../../components/LinkExistingRecordDialog'
import { CreateAndLinkRecordDialog } from '../../components/CreateAndLinkRecordDialog'
import { ClubContactForm, CLUB_CONTACT_FORM_ID } from '../../components/ClubContactForm'
import { SponsorForm, SPONSOR_FORM_ID } from '../../components/SponsorForm'
import { listTeamsForSection, createTeam, updateTeam, deactivateTeam, reactivateTeam } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { getManagedClubProfile } from '../../api/clubApi'
import { listClubContacts, createClubContact } from '../../api/clubContactApi'
import type { ClubContact, ClubContactPayload } from '../../api/clubContactApi'
import { listTeamContacts, linkTeamContact, unlinkTeamContact } from '../../api/teamContactApi'
import type { TeamContact } from '../../api/teamContactApi'
import { listSponsors, createSponsor } from '../../api/sponsorApi'
import type { Sponsor, SponsorPayload } from '../../api/sponsorApi'
import { listTeamSponsors, linkTeamSponsor, unlinkTeamSponsor } from '../../api/teamSponsorApi'
import { listPlayers } from '../../api/playerApi'
import type { Player } from '../../api/playerApi'
import { listSquad, addToSquad, removeFromSquad, updateSquadJerseyNumber } from '../../api/teamSquadApi'
import type { SquadMember } from '../../api/teamSquadApi'
import { listSeasons } from '../../api/seasonApi'
import { sponsorRecordFields } from '../../utils/sponsorRecordFields'
import { playerRecordFields } from '../../utils/playerRecordFields'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { errorDetail } from '../../utils/errorDetail'
import { initialsFromName } from '../../utils/initials'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { numberToInput, inputToNumber } from '../../utils/numberInput'

const ROLE_QUICK_FILL = ['Manager', 'Coach', 'Assistant Coach']

// Mirrors TeamDirectory.tsx's own local CLUB_TEAMS_QUERY_KEY (not exported from teamApi.ts) — the
// relocated deactivate/reactivate toggle below must invalidate both this club-wide key and the
// section-scoped one TeamList.tsx reads from, since the admin may have arrived from either list
// (docs/specs/038-move-deactivate-to-edit-screen.md).
const CLUB_TEAMS_QUERY_KEY = (clubId?: string) => ['managed-club', clubId, 'teams']

// One RecordCard per linked contact, with its own unlink mutation so one card's pending state
// never leaks onto another's (same isolation ClubContactList.tsx's own ClubContactCard uses).
// editTo navigates to the real ClubContactFormPage edit route (021-club-contacts.md) — real user
// feedback on the first version of this tab (a bare Avatar+name row) asked for exactly this: a way
// to actually see a linked record's details or edit it, not just its name.
function TeamContactCard({
  clubId,
  sectionId,
  teamId,
  teamContact,
  onUnlinked,
}: {
  clubId: string
  sectionId: string
  teamId: string
  teamContact: TeamContact
  onUnlinked: () => void
}) {
  const unlink = useMutation({
    mutationFn: () => unlinkTeamContact(clubId, sectionId, teamId, teamContact.contact.id),
    onSuccess: onUnlinked,
  })
  const contact = teamContact.contact
  const contactName = `${contact.contact.firstName} ${contact.contact.lastName}`

  return (
    <RecordCard
      title={contactName}
      avatar={{ imageUrl: contact.photoUrl, fallback: initialsFromName(contactName), shape: 'circular' }}
      fields={[
        { label: 'Team role', value: teamContact.role },
        { label: 'Email', value: contact.contact.email },
        { label: 'Phone', value: contact.contact.phone },
      ]}
      editLabel="Edit"
      editTo={`/manage/club-contacts/${contact.id}/edit`}
      secondaryAction={{
        label: 'Unlink',
        pendingLabel: 'Unlinking…',
        pending: unlink.isPending,
        onClick: () => unlink.mutate(),
        icon: <LinkOffOutlinedIcon fontSize="small" />,
      }}
    />
  )
}

// This team's own linked sponsor — same isolation/editTo reasoning as TeamContactCard, editing
// navigates to the real SponsorFormPage edit route (023-sponsors.md).
function TeamSponsorCard({
  clubId,
  sectionId,
  teamId,
  sponsor,
  onUnlinked,
}: {
  clubId: string
  sectionId: string
  teamId: string
  sponsor: Sponsor
  onUnlinked: () => void
}) {
  const unlink = useMutation({
    mutationFn: () => unlinkTeamSponsor(clubId, sectionId, teamId, sponsor.id),
    onSuccess: onUnlinked,
  })

  return (
    <RecordCard
      title={sponsor.name}
      avatar={{ imageUrl: sponsor.logoUrl, fallback: initialsFromName(sponsor.name), shape: 'rounded' }}
      fields={sponsorRecordFields(sponsor)}
      editLabel="Edit"
      editTo={`/manage/sponsors/${sponsor.id}/edit`}
      secondaryAction={{
        label: 'Unlink',
        pendingLabel: 'Unlinking…',
        pending: unlink.isPending,
        onClick: () => unlink.mutate(),
        icon: <LinkOffOutlinedIcon fontSize="small" />,
      }}
    />
  )
}

// A club sponsor not (yet) linked to this team — view/edit only, no unlink action since there's
// nothing to unlink.
function ClubSponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <RecordCard
      title={sponsor.name}
      avatar={{ imageUrl: sponsor.logoUrl, fallback: initialsFromName(sponsor.name), shape: 'rounded' }}
      fields={sponsorRecordFields(sponsor)}
      editLabel="Edit"
      editTo={`/manage/sponsors/${sponsor.id}/edit`}
    />
  )
}

// One player in this team's squad for the selected season, with its own remove mutation —
// mirrors TeamSponsorCard's isolation pattern. docs/specs/029-league-management.md: removing a
// player only affects that season's squad row, never the player record itself.
//
// docs/specs/031-jersey-numbers.md adds an inline-editable "Squad #" field — its own isolated
// useMutation (calling the new updateSquadJerseyNumber), completely separate from `remove`'s, so
// neither one card's pending/error state nor a sibling card's ever leaks across. A 409 (another
// squad member already holds that number this season) surfaces via RecordCard's own `feedback`
// prop rather than a page-level toast.
function SquadPlayerCard({
  clubId,
  teamId,
  seasonId,
  member,
  onRemoved,
  onJerseyNumberChanged,
}: {
  clubId: string
  teamId: string
  seasonId: string
  member: SquadMember
  onRemoved: () => void
  onJerseyNumberChanged: () => void
}) {
  // The squad/remove/update endpoints are addressed by playerProfileId, not member.id (the
  // TeamSquadMember row's own id) — see teamSquadApi.ts's SquadMember doc comment.
  const remove = useMutation({
    mutationFn: () => removeFromSquad(clubId, teamId, seasonId, member.playerProfileId),
    onSuccess: onRemoved,
  })

  const [jerseyNumberInput, setJerseyNumberInput] = useState(numberToInput(member.squadJerseyNumber))

  const updateJerseyNumber = useMutation({
    mutationFn: (jerseyNumber: number | null) =>
      updateSquadJerseyNumber(clubId, teamId, seasonId, member.playerProfileId, jerseyNumber),
    onSuccess: onJerseyNumberChanged,
  })

  const playerName = `${member.firstName} ${member.lastName}`

  const commitJerseyNumber = () => {
    const parsed = inputToNumber(jerseyNumberInput)
    if (parsed !== member.squadJerseyNumber) {
      updateJerseyNumber.mutate(parsed)
    }
  }

  return (
    <RecordCard
      title={playerName}
      avatar={{ imageUrl: member.photoUrl, fallback: initialsFromName(playerName), shape: 'circular' }}
      fields={[
        ...playerRecordFields(member),
        {
          label: 'Squad #',
          // No visible label of its own — RecordCard already renders the "Squad #" caption above
          // this field's value (docs/specs/031-jersey-numbers.md's UI Requirements) — `label=""`
          // suppresses TextField's own InputLabel, and `inputProps.aria-label` (which lands on the
          // real <input>, unlike a bare `aria-label` prop on TextField itself) keeps it accessible.
          value: (
            <Input
              label=""
              type="number"
              size="small"
              inputProps={{ 'aria-label': `${playerName} squad number` }}
              value={jerseyNumberInput}
              onChange={(event) => setJerseyNumberInput(event.target.value)}
              onBlur={commitJerseyNumber}
              disabled={updateJerseyNumber.isPending}
              sx={{ width: 88 }}
            />
          ),
        },
      ]}
      editLabel="Edit"
      editTo={`/manage/players/${member.playerProfileId}/edit`}
      secondaryAction={{
        label: 'Remove',
        pendingLabel: 'Removing…',
        pending: remove.isPending,
        onClick: () => remove.mutate(),
        icon: <LinkOffOutlinedIcon fontSize="small" />,
      }}
      feedback={
        updateJerseyNumber.isError
          ? { message: errorDetail(updateJerseyNumber.error, "Couldn't update this squad number. Please try again."), tone: 'error' }
          : null
      }
    />
  )
}

// Shared by three routes (docs/specs/026-teams.md): sections/:sectionId/teams/new,
// sections/:sectionId/teams/:teamId/edit (section-scoped create/edit — section fixed by the
// route, no picker), and teams/new (club-wide create — sectionId is absent, TeamForm renders a
// required section picker instead, and the chosen value drives which nested create call fires).
// teamId is never present without sectionId also being present — editing always happens via the
// section-scoped route (re-parenting is out of scope).
//
// docs/specs/027-team-profile.md extends this with a section-ancestry breadcrumb (every mode) and,
// in edit mode only, Contacts and Sponsors sections below the form — a team needs a real,
// persisted id to attach either to, same constraint 025 already designed SectionDetailPanel's own
// contact-linking around.
export default function TeamFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { sectionId, teamId } = useParams<{ sectionId?: string; teamId?: string }>()
  const isEdit = Boolean(teamId)
  const isSectionScoped = Boolean(sectionId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Which tab is showing — Details is always tab 0; Contacts/Sponsors only exist once
  // showContactsAndSponsors is true (edit mode), so this stays 0 for the lifetime of a create-mode
  // page. Real-user feedback on the first version of this page (which stacked Details/Contacts/
  // Sponsors vertically in one long scroll) asked for this — matches SponsorForm's own existing
  // Tabs pattern (docs/specs/023-sponsors.md) rather than the earlier scroll-everything layout.
  const [activeTab, setActiveTab] = useState(0)
  const [contactLinkOpen, setContactLinkOpen] = useState(false)
  const [contactCreateOpen, setContactCreateOpen] = useState(false)
  const [sponsorLinkOpen, setSponsorLinkOpen] = useState(false)
  const [sponsorCreateOpen, setSponsorCreateOpen] = useState(false)
  const [squadLinkOpen, setSquadLinkOpen] = useState(false)
  const [selectedSquadSeasonId, setSelectedSquadSeasonId] = useState('')

  // There's no single-team GET endpoint (only list/create/update/deactivate/reactivate, per the
  // spec's API Contract) — edit mode fetches the full (small, unpaginated) section list and finds
  // the matching row client-side rather than adding a new backend endpoint, same as
  // ClubContactFormPage.tsx.
  const {
    data: team,
    isLoading: isLoadingTeam,
    isError: isTeamError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams'],
    queryFn: () => listTeamsForSection(clubId as string, sectionId as string),
    enabled: Boolean(clubId) && Boolean(sectionId) && isEdit,
    select: (teams) => teams.find((candidate) => candidate.id === teamId),
  })

  // Unconditionally enabled (not just for club-wide create's section picker, docs/specs/
  // 027-team-profile.md) — every mode now needs the full section list to resolve the
  // section-ancestry breadcrumb.
  const {
    data: sections,
    isLoading: isLoadingSections,
    isError: isSectionsError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  // Feeds TeamForm's clubLogoUrl fallback prop (docs/specs/027-team-profile.md, 020's existing
  // getManagedClubProfile call).
  const { data: clubProfile } = useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId as string),
    enabled: Boolean(clubId),
  })

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(sections ?? []).forEach((section) => map.set(section.id, section))
    return map
  }, [sections])

  // The route's own sectionId when section-scoped (create or edit); otherwise, once a club-wide
  // create's team has actually been created, its own freshly-assigned sectionId. Neither exists
  // for a club-wide create still in progress — no breadcrumb renders yet, there's nothing to show
  // a path to.
  const breadcrumbSectionId = sectionId ?? team?.sectionId
  const breadcrumbSection = breadcrumbSectionId ? sectionsById.get(breadcrumbSectionId) : undefined
  const breadcrumbTrail = breadcrumbSection ? [...breadcrumbFor(breadcrumbSection, sectionsById), breadcrumbSection.name] : []

  const saveMutation = useMutation({
    mutationFn: (payload: TeamFormValues) => {
      const targetSectionId = isSectionScoped ? (sectionId as string) : (payload.sectionId as string)
      if (isEdit && teamId && sectionId) {
        return updateTeam(clubId as string, sectionId, teamId, { name: payload.name, logoUrl: payload.logoUrl })
      }
      return createTeam(clubId as string, targetSectionId, { name: payload.name, logoUrl: payload.logoUrl })
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'sections', created.sectionId, 'teams'] })
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'teams'] })
      navigate(isSectionScoped ? `/manage/sections/${sectionId}/teams` : '/manage/teams')
    },
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated verbatim from both TeamDirectory.tsx
  // and TeamList.tsx's own TeamCard — invalidates the union of both lists' own query keys, since
  // the admin may have arrived at this edit screen from either one.
  const invalidateTeams = () => {
    queryClient.invalidateQueries({ queryKey: CLUB_TEAMS_QUERY_KEY(clubId) })
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams'] })
  }

  const deactivate = useMutation({
    mutationFn: () => deactivateTeam(clubId as string, sectionId as string, teamId as string),
    onSuccess: invalidateTeams,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateTeam(clubId as string, sectionId as string, teamId as string),
    onSuccess: invalidateTeams,
  })

  const toggle = team?.active ? deactivate : reactivate

  // --- Contacts (docs/specs/027-team-profile.md), edit mode only ---

  const teamContactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams', teamId, 'contacts'],
    queryFn: () => listTeamContacts(clubId as string, sectionId as string, teamId as string),
    enabled: Boolean(clubId) && Boolean(sectionId) && Boolean(teamId) && isEdit,
  })

  const clubContactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'contacts'],
    queryFn: () => listClubContacts(clubId as string),
    enabled: Boolean(clubId) && (contactLinkOpen || contactCreateOpen),
  })

  const invalidateTeamContacts = () =>
    queryClient.invalidateQueries({
      queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams', teamId, 'contacts'],
    })

  const linkContactMutation = useMutation({
    mutationFn: ({ contactId, role }: { contactId: string; role: string }) =>
      linkTeamContact(clubId as string, sectionId as string, teamId as string, contactId, role),
    onSuccess: () => {
      invalidateTeamContacts()
      setContactLinkOpen(false)
    },
  })

  const createAndLinkContactMutation = useMutation({
    mutationFn: async ({ payload, role }: { payload: ClubContactPayload; role: string }) => {
      const contact = await createClubContact(clubId as string, payload)
      await linkTeamContact(clubId as string, sectionId as string, teamId as string, contact.id, role)
      return contact
    },
    onSuccess: () => {
      invalidateTeamContacts()
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'contacts'] })
      setContactCreateOpen(false)
    },
  })

  const alreadyLinkedContactIds = new Set((teamContactsQuery.data ?? []).map((teamContact) => teamContact.contact.id))
  const linkableContacts: ClubContact[] = (clubContactsQuery.data ?? []).filter(
    (contact) => !alreadyLinkedContactIds.has(contact.id),
  )

  // --- Sponsors (docs/specs/027-team-profile.md), edit mode only ---

  const teamSponsorsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams', teamId, 'sponsors'],
    queryFn: () => listTeamSponsors(clubId as string, sectionId as string, teamId as string),
    enabled: Boolean(clubId) && Boolean(sectionId) && Boolean(teamId) && isEdit,
  })

  // Always fetched in edit mode (not just while a dialog is open) — unlike clubContactsQuery
  // above, this same result also drives the always-visible read-only "Club sponsors" list.
  const clubSponsorsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors'],
    queryFn: () => listSponsors(clubId as string),
    enabled: Boolean(clubId) && isEdit,
  })

  const invalidateTeamSponsors = () =>
    queryClient.invalidateQueries({
      queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams', teamId, 'sponsors'],
    })

  const linkSponsorMutation = useMutation({
    mutationFn: (sponsorId: string) => linkTeamSponsor(clubId as string, sectionId as string, teamId as string, sponsorId),
    onSuccess: () => {
      invalidateTeamSponsors()
      setSponsorLinkOpen(false)
    },
  })

  const createAndLinkSponsorMutation = useMutation({
    mutationFn: async (payload: SponsorPayload) => {
      const sponsor = await createSponsor(clubId as string, payload)
      await linkTeamSponsor(clubId as string, sectionId as string, teamId as string, sponsor.id)
      return sponsor
    },
    onSuccess: () => {
      invalidateTeamSponsors()
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'sponsors'] })
      setSponsorCreateOpen(false)
    },
  })

  // Both this team's own "link existing" candidate pool and the read-only "Club sponsors" list
  // use the exact same filter — everything the club has that isn't already linked to this team,
  // so nothing is ever shown twice (docs/specs/027-team-profile.md's UI Requirements).
  const alreadyLinkedSponsorIds = new Set((teamSponsorsQuery.data ?? []).map((sponsor) => sponsor.id))
  const otherClubSponsors: Sponsor[] = (clubSponsorsQuery.data ?? []).filter(
    (sponsor) => !alreadyLinkedSponsorIds.has(sponsor.id),
  )

  // --- Squad (docs/specs/029-league-management.md), edit mode only, season-scoped ---

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId) && Boolean(teamId) && isEdit,
  })

  // Defaults the Season picker to whichever season contains today, else the most recently
  // created — docs/specs/029-league-management.md's pre-build amendment.
  useEffect(() => {
    if (!selectedSquadSeasonId && seasonsQuery.data && seasonsQuery.data.length > 0) {
      const defaultId = pickDefaultSeasonId(seasonsQuery.data)
      if (defaultId) {
        setSelectedSquadSeasonId(defaultId)
      }
    }
  }, [seasonsQuery.data, selectedSquadSeasonId])

  const squadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', selectedSquadSeasonId, 'squad'],
    queryFn: () => listSquad(clubId as string, teamId as string, selectedSquadSeasonId),
    enabled: Boolean(clubId) && Boolean(teamId) && isEdit && Boolean(selectedSquadSeasonId),
  })

  // Only fetched while the "Add player" dialog is open — same pattern as clubContactsQuery above.
  const clubPlayersQuery = useQuery({
    queryKey: ['managed-club', clubId, 'players'],
    queryFn: () => listPlayers(clubId as string),
    enabled: Boolean(clubId) && squadLinkOpen,
  })

  const invalidateSquad = () =>
    queryClient.invalidateQueries({
      queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', selectedSquadSeasonId, 'squad'],
    })

  const addToSquadMutation = useMutation({
    mutationFn: (playerId: string) => addToSquad(clubId as string, teamId as string, selectedSquadSeasonId, playerId),
    onSuccess: () => {
      invalidateSquad()
      setSquadLinkOpen(false)
    },
  })

  const alreadyInSquadIds = new Set((squadQuery.data ?? []).map((member) => member.playerProfileId))
  const linkablePlayers: Player[] = (clubPlayersQuery.data ?? []).filter(
    (player) => player.active && !alreadyInSquadIds.has(player.id),
  )

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isEdit && !sectionId) {
    return <EmptyState title="Not found" description="No section was specified." />
  }

  if (isEdit && isLoadingTeam) {
    return null
  }

  if (isEdit && (isTeamError || !team)) {
    return (
      <EmptyState
        title="Couldn't load this team"
        description="Something went wrong loading this team. Please try again."
      />
    )
  }

  if (!isSectionScoped && isLoadingSections) {
    return null
  }

  if (!isSectionScoped && (isSectionsError || !sections)) {
    return (
      <EmptyState
        title="Couldn't load sections"
        description="Something went wrong loading your club's sections. Please try again."
      />
    )
  }

  const backTo = isSectionScoped ? `/manage/sections/${sectionId}/teams` : '/manage/teams'
  const showContactsAndSponsors = isEdit && Boolean(team) && Boolean(sectionId) && Boolean(teamId)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <RecordFormScreen
        title={isEdit ? 'Edit Team' : 'Add Team'}
        backTo={backTo}
        backLabel="Back to Teams"
        actions={
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            {activeTab === 0 && (
              <>
                {saveMutation.isError && (
                  <Typography variant="body2" color="error.main">
                    {errorDetail(saveMutation.error, 'Something went wrong saving this team. Please try again.')}
                  </Typography>
                )}

                <Button type="submit" form={TEAM_FORM_ID} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create team'}
                </Button>
              </>
            )}

            {isEdit && team && (
              <RecordStatusToggle active={team.active} pending={toggle.isPending} onClick={() => toggle.mutate()} />
            )}
          </Stack>
        }
      >
        {breadcrumbTrail.length > 0 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Breadcrumbs separator="›" sx={{ fontSize: 13 }}>
              {breadcrumbTrail.map((crumb, index) => (
                <Typography
                  key={crumb}
                  variant="caption"
                  color={index === breadcrumbTrail.length - 1 ? 'text.primary' : 'text.secondary'}
                  fontWeight={index === breadcrumbTrail.length - 1 ? 600 : 400}
                >
                  {crumb}
                </Typography>
              ))}
            </Breadcrumbs>
          </Box>
        )}

        {/* Tabs only exist once there's more than one thing to switch between — a brand-new team
            (create mode, either route) has no id yet to attach contacts/sponsors to, so it just
            renders the Details form directly below, exactly as before. */}
        {showContactsAndSponsors && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Tabs
              value={activeTab}
              onChange={(_event, next: number) => setActiveTab(next)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
            >
              <Tab label="Details" />
              <Tab label="Contacts" />
              <Tab label="Sponsors" />
              <Tab label="Squad" />
            </Tabs>
          </Box>
        )}

        {activeTab === 0 && (
          <TeamForm
            initialValues={team ? { name: team.name, logoUrl: team.logoUrl } : undefined}
            sections={isSectionScoped ? undefined : sections}
            clubLogoUrl={clubProfile?.logoUrl ?? null}
            onSubmit={(payload) => saveMutation.mutate(payload)}
          />
        )}

        {showContactsAndSponsors && activeTab === 1 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            {(teamContactsQuery.data ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                No contacts linked to this team yet.
              </Typography>
            )}

            {(teamContactsQuery.data ?? []).length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  mb: 2,
                }}
              >
                {(teamContactsQuery.data ?? []).map((teamContact) => (
                  <TeamContactCard
                    key={teamContact.id}
                    clubId={clubId as string}
                    sectionId={sectionId as string}
                    teamId={teamId as string}
                    teamContact={teamContact}
                    onUnlinked={invalidateTeamContacts}
                  />
                ))}
              </Box>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              <Button variant="secondary" size="sm" onClick={() => setContactLinkOpen(true)}>
                Link existing
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setContactCreateOpen(true)}>
                + New contact
              </Button>
            </Stack>
          </Box>
        )}

        {showContactsAndSponsors && activeTab === 2 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              This team's sponsors
            </Typography>

            {(teamSponsorsQuery.data ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                No sponsors linked to this team yet.
              </Typography>
            )}

            {(teamSponsorsQuery.data ?? []).length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  mb: 2,
                }}
              >
                {(teamSponsorsQuery.data ?? []).map((sponsor) => (
                  <TeamSponsorCard
                    key={sponsor.id}
                    clubId={clubId as string}
                    sectionId={sectionId as string}
                    teamId={teamId as string}
                    sponsor={sponsor}
                    onUnlinked={invalidateTeamSponsors}
                  />
                ))}
              </Box>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5, mb: 3 }}>
              <Button variant="secondary" size="sm" onClick={() => setSponsorLinkOpen(true)}>
                Link existing
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSponsorCreateOpen(true)}>
                + New sponsor
              </Button>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Club sponsors
            </Typography>

            {otherClubSponsors.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No other club sponsors.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                }}
              >
                {otherClubSponsors.map((sponsor) => (
                  <ClubSponsorCard key={sponsor.id} sponsor={sponsor} />
                ))}
              </Box>
            )}
          </Box>
        )}

        {showContactsAndSponsors && activeTab === 3 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            {(seasonsQuery.data ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Create a season first — a squad is always built for a specific season.
              </Typography>
            ) : (
              <>
                <Input
                  select
                  label="Season"
                  value={selectedSquadSeasonId}
                  onChange={(event) => setSelectedSquadSeasonId(event.target.value)}
                  sx={{ maxWidth: 280, mb: 2 }}
                >
                  {(seasonsQuery.data ?? []).map((season) => (
                    <MenuItem key={season.id} value={season.id}>
                      {season.label}
                    </MenuItem>
                  ))}
                </Input>

                {(squadQuery.data ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    No players in this team's squad for this season yet.
                  </Typography>
                )}

                {(squadQuery.data ?? []).length > 0 && (
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      mb: 2,
                    }}
                  >
                    {(squadQuery.data ?? []).map((member) => (
                      <SquadPlayerCard
                        key={member.id}
                        clubId={clubId as string}
                        teamId={teamId as string}
                        seasonId={selectedSquadSeasonId}
                        member={member}
                        onRemoved={invalidateSquad}
                        onJerseyNumberChanged={invalidateSquad}
                      />
                    ))}
                  </Box>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSquadLinkOpen(true)}
                  disabled={!selectedSquadSeasonId}
                >
                  Add player
                </Button>
              </>
            )}
          </Box>
        )}
      </RecordFormScreen>

      {showContactsAndSponsors && (
        <>
          <LinkExistingRecordDialog<ClubContact>
            open={contactLinkOpen}
            onClose={() => setContactLinkOpen(false)}
            title="Link an existing contact to this team"
            candidates={linkableContacts}
            loading={clubContactsQuery.isFetching}
            getOptionLabel={(option) => `${option.contact.firstName} ${option.contact.lastName} — ${option.role}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            searchLabel="Search contacts"
            searchPlaceholder="Search by name or role"
            onLink={(option, role) => linkContactMutation.mutate({ contactId: option.id, role: role as string })}
            extraField={{ label: 'Role', quickFillOptions: ROLE_QUICK_FILL }}
          />

          <CreateAndLinkRecordDialog<ClubContactPayload>
            open={contactCreateOpen}
            onClose={() => setContactCreateOpen(false)}
            title="New contact"
            formId={CLUB_CONTACT_FORM_ID}
            renderForm={(onSubmit) => <ClubContactForm onSubmit={onSubmit} />}
            onCreateAndLink={(payload, role) => createAndLinkContactMutation.mutate({ payload, role: role as string })}
            isPending={createAndLinkContactMutation.isPending}
            isError={createAndLinkContactMutation.isError}
            errorMessage={errorDetail(
              createAndLinkContactMutation.error,
              "Couldn't create and link this contact. Please try again.",
            )}
            extraField={{ label: 'Role', quickFillOptions: ROLE_QUICK_FILL }}
          />

          <LinkExistingRecordDialog<Sponsor>
            open={sponsorLinkOpen}
            onClose={() => setSponsorLinkOpen(false)}
            title="Link an existing sponsor to this team"
            candidates={otherClubSponsors}
            loading={clubSponsorsQuery.isFetching}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            searchLabel="Search sponsors"
            searchPlaceholder="Search by name"
            onLink={(option) => linkSponsorMutation.mutate(option.id)}
          />

          <CreateAndLinkRecordDialog<SponsorPayload>
            open={sponsorCreateOpen}
            onClose={() => setSponsorCreateOpen(false)}
            title="New sponsor"
            formId={SPONSOR_FORM_ID}
            renderForm={(onSubmit) => <SponsorForm onSubmit={onSubmit} />}
            onCreateAndLink={(payload) => createAndLinkSponsorMutation.mutate(payload)}
            isPending={createAndLinkSponsorMutation.isPending}
            isError={createAndLinkSponsorMutation.isError}
            errorMessage={errorDetail(
              createAndLinkSponsorMutation.error,
              "Couldn't create and link this sponsor. Please try again.",
            )}
          />

          <LinkExistingRecordDialog<Player>
            open={squadLinkOpen}
            onClose={() => setSquadLinkOpen(false)}
            title="Add a player to this season's squad"
            candidates={linkablePlayers}
            loading={clubPlayersQuery.isFetching}
            getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            searchLabel="Search players"
            searchPlaceholder="Search by name"
            onLink={(option) => addToSquadMutation.mutate(option.id)}
          />
        </>
      )}
    </Box>
  )
}
