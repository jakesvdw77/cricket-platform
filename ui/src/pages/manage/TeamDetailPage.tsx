import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, Link as MuiLink, MenuItem, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Input } from '../../components/Input'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { RecordQuickViewDialog } from '../../components/RecordQuickViewDialog'
import { RecordIconButton } from '../../components/RecordIconButton'
import { SponsorQuickViewDialog } from '../../components/SponsorQuickViewDialog'
import { avatarSx, badgeSx } from '../../components/RecordCard'
import { listTeamsForClub } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { listTeamContacts } from '../../api/teamContactApi'
import { listTeamSponsors } from '../../api/teamSponsorApi'
import { listSquad } from '../../api/teamSquadApi'
import type { SquadMember } from '../../api/teamSquadApi'
import { listSeasons } from '../../api/seasonApi'
import { listMatches } from '../../api/matchApi'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { initialsFromName } from '../../utils/initials'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { badgeFor } from './TeamDirectory'

// The small "section label + optional action" header row every card on this page uses — mirrors
// ClubOverviewPage.tsx's own identical convention (docs/specs/056-club-profile-overview.md) of
// building this row by hand inside Card's children rather than Card's own `title` prop, since that
// prop has no room for a trailing action button.
function CardHeaderRow({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
      {action}
    </Stack>
  )
}

// One player tile in the full-width Squad grid — avatar, name, jersey number, the captain's tile
// visually distinguished with a highlighted border/background plus a small "Captain" label
// (docs/specs/057-team-extended-profile.md's UI Requirements, matching the approved mockup).
// Deliberately view-only here — no Edit action on this read-only Team View screen (real user
// feedback: a squad member shouldn't be directly editable from a page whose own header is itself
// "View", not "Edit"). The name is still the click-to-view stretched link into that player's own
// record, where Edit lives, same as every other cross-linked record on this page.
function SquadPlayerTile({ member }: { member: SquadMember }) {
  const playerName = `${member.firstName} ${member.lastName}`
  return (
    <Box
      sx={{
        border: 1,
        borderColor: member.isCaptain ? 'primary.main' : 'divider',
        bgcolor: (theme) => (member.isCaptain ? alpha(theme.palette.primary.main, 0.06) : 'background.paper'),
        borderRadius: 2,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        position: 'relative',
        transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
        outline: '1px solid transparent',
        '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar src={member.photoUrl ?? undefined} variant="circular" sx={avatarSx(40, '0.8125rem')}>
          {initialsFromName(playerName)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {/* Stretched-link, same pattern as RecordCard.tsx (position: static on the link
                itself so its ::after resolves its containing block to the outer Box above). */}
            <MuiLink
              component={RouterLink}
              to={`/manage/players/${member.playerProfileId}`}
              color="inherit"
              underline="none"
              sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}
            >
              {playerName}
            </MuiLink>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {member.squadJerseyNumber != null ? `#${member.squadJerseyNumber}` : 'No squad number'}
          </Typography>
        </Box>
      </Stack>

      {member.isCaptain && (
        <Chip
          size="small"
          icon={<MilitaryTechOutlinedIcon />}
          label="Captain"
          sx={{ alignSelf: 'flex-start', ...badgeSx('positive'), '& .MuiChip-icon': { color: 'inherit' } }}
        />
      )}
    </Box>
  )
}

// docs/specs/057-team-extended-profile.md: full restructure to the approved "Squad-Focused" bento
// layout, mirroring 056's ClubOverviewPage posture directly — header chips under the name (no
// separate "Details" section), Contacts/Sponsors as tap-to-view icon grids side by side, a
// full-width Squad grid with the captain visually distinguished. Same data-fetch shape as
// TeamDirectory.tsx (listTeamsForClub + find-by-id; route always carries sectionId per
// docs/specs/035-section-scoped-access.md).
//
// Back-navigation fix: reads the `from` query param (set by TeamList.tsx's own viewTo/editTo links,
// see that file) — `?from=section` present routes Back to the section-scoped Teams list (genuinely
// reached via Club Structure); absent (the default — the club-wide directory, a bookmark, or a
// typed URL) routes Back to the club-wide Teams directory instead of always routing through the
// section-scoped list regardless of origin (the bug this spec fixes).
export default function TeamDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { sectionId, teamId } = useParams<{ sectionId?: string; teamId?: string }>()
  const [searchParams] = useSearchParams()
  const fromSection = searchParams.get('from') === 'section'
  const [openContactId, setOpenContactId] = useState<string | null>(null)
  const [openSponsorId, setOpenSponsorId] = useState<string | null>(null)
  const [selectedSquadSeasonId, setSelectedSquadSeasonId] = useState('')

  const {
    data: team,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
    select: (teams) => teams.find((candidate) => candidate.id === teamId),
  })

  const sectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(sectionsQuery.data ?? []).forEach((section) => map.set(section.id, section))
    return map
  }, [sectionsQuery.data])

  const breadcrumbSection = sectionId ? sectionsById.get(sectionId) : undefined
  const sectionBreadcrumb = breadcrumbSection
    ? [...breadcrumbFor(breadcrumbSection, sectionsById), breadcrumbSection.name].join(' › ')
    : '—'

  const teamContactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams', teamId, 'contacts'],
    queryFn: () => listTeamContacts(clubId as string, sectionId as string, teamId as string),
    enabled: Boolean(clubId) && Boolean(sectionId) && Boolean(teamId),
  })

  const teamSponsorsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams', teamId, 'sponsors'],
    queryFn: () => listTeamSponsors(clubId as string, sectionId as string, teamId as string),
    enabled: Boolean(clubId) && Boolean(sectionId) && Boolean(teamId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId) && Boolean(teamId),
  })

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
    enabled: Boolean(clubId) && Boolean(teamId) && Boolean(selectedSquadSeasonId),
  })

  // docs/specs/057-team-extended-profile.md's Non-goals: no new "matches" backend field — computed
  // client-side from the club's own selected-season matches, filtered to this team's home/away id,
  // same posture useTeamCardData.ts uses for the redesigned card.
  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', 'team-detail-season', selectedSquadSeasonId],
    queryFn: () => listMatches(clubId as string, { page: 0, size: 200, seasonId: selectedSquadSeasonId }),
    enabled: Boolean(clubId) && Boolean(selectedSquadSeasonId),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (!sectionId) {
    return <EmptyState title="Not found" description="No section was specified." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !team) {
    return (
      <EmptyState
        title="Couldn't load this team"
        description="Something went wrong loading this team. Please try again."
      />
    )
  }

  const backTo = fromSection ? `/manage/sections/${sectionId}/teams` : '/manage/teams'
  const backLabel = 'Back to Teams'
  const editTo = `/manage/sections/${sectionId}/teams/${team.id}/edit`

  // Sorted by name regardless of the server's own row order — same fix TeamFormPage's Squad tab
  // applies, per direct user feedback that an unordered fetch visibly reshuffling the grid read as
  // a bug.
  const squad = [...(squadQuery.data ?? [])].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
  )
  const captain = squad.find((member) => member.isCaptain)
  const captainName = captain ? `${captain.firstName} ${captain.lastName}` : null
  const playerCount = squad.length
  const matches = matchesQuery.data?.content ?? []
  const matchCount = matches.filter((match) => match.homeTeamId === team.id || match.awayTeamId === team.id).length

  const contacts = teamContactsQuery.data ?? []
  const sponsors = teamSponsorsQuery.data ?? []
  const seasons = seasonsQuery.data ?? []

  const selectedContact = contacts.find((teamContact) => teamContact.id === openContactId) ?? null
  const selectedSponsor = sponsors.find((sponsor) => sponsor.id === openSponsorId) ?? null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
        <MuiButton
          component={RouterLink}
          to={backTo}
          variant="text"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ mb: 1, ml: -1, color: 'text.secondary' }}
        >
          {backLabel}
        </MuiButton>

        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} flexWrap="wrap" useFlexGap>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Avatar src={team.logoUrl ?? undefined} variant="rounded" sx={avatarSx(56)}>
              {initialsFromName(team.name)}
            </Avatar>
            <Stack spacing={0.75} sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="h1" noWrap sx={{ fontWeight: 700 }}>
                {team.name}
              </Typography>
              {/* The "badges under the name" chip row replacing the old "Details" section entirely
                  — docs/specs/057-team-extended-profile.md's UI Requirements, same posture 056's
                  ClubOverviewPage established for Club Details. */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" icon={<AccountTreeOutlinedIcon />} variant="outlined" label={sectionBreadcrumb} />
                {team.groundName && <Chip size="small" icon={<PlaceOutlinedIcon />} variant="outlined" label={team.groundName} />}
                {captainName && (
                  <Chip size="small" icon={<MilitaryTechOutlinedIcon />} variant="outlined" label={`Captain: ${captainName}`} />
                )}
                <Chip size="small" icon={<GroupsOutlinedIcon />} variant="outlined" label={`${playerCount} players`} />
                <Chip size="small" icon={<EventOutlinedIcon />} variant="outlined" label={`${matchCount} matches`} />
                {badgeFor(team) && (
                  <Chip size="small" label={badgeFor(team)?.label} sx={badgeSx(badgeFor(team)?.tone ?? 'muted')} />
                )}
              </Stack>
            </Stack>
          </Stack>

          <MuiButton
            component={RouterLink}
            to={editTo}
            variant="outlined"
            startIcon={<EditOutlinedIcon fontSize="small" />}
            sx={{
              flex: 'none',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              color: 'primary.dark',
              borderColor: 'transparent',
              '&:hover': {
                borderColor: 'transparent',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            Edit team
          </MuiButton>
        </Stack>
      </PageHeaderBand>

      {/* Contacts + Sponsors — two-column grid, stacking to one column at xs (docs/specs/
          057-team-extended-profile.md's Mobile-first note). */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Card>
          <CardHeaderRow title="Contacts" />
          {contacts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No contacts linked to this team yet.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {contacts.map((teamContact) => {
                const contactName = `${teamContact.contact.contact.firstName} ${teamContact.contact.contact.lastName}`
                return (
                  <RecordIconButton
                    key={teamContact.id}
                    imageUrl={teamContact.contact.photoUrl}
                    shape="circular"
                    label={`${contactName} — ${teamContact.role}`}
                    name={contactName}
                    initials={initialsFromName(contactName)}
                    onClick={() => setOpenContactId(teamContact.id)}
                  />
                )
              })}
            </Stack>
          )}
        </Card>

        <Card>
          <CardHeaderRow title="Sponsors" />
          {sponsors.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No sponsors linked to this team yet.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {sponsors.map((sponsor) => (
                <RecordIconButton
                  key={sponsor.id}
                  imageUrl={sponsor.logoUrl}
                  shape="rounded"
                  label={`${sponsor.name} — Sponsor`}
                  name={sponsor.name}
                  initials={initialsFromName(sponsor.name)}
                  onClick={() => setOpenSponsorId(sponsor.id)}
                />
              ))}
            </Stack>
          )}
        </Card>
      </Box>

      {/* Full-width Squad card — a grid of richer player tiles, the captain's tile visually
          distinguished. Season picker in the card header, same pickDefaultSeasonId-driven default
          the previous Squad section already used. "Add player" navigates to the edit screen's own
          Squad tab, the one place squad membership is actually mutated (view-first posture,
          docs/specs/036-view-first-record-detail-screens.md). */}
      <Card>
        <CardHeaderRow
          title="Squad"
          action={
            seasons.length > 0 ? (
              <Input
                select
                label="Season"
                value={selectedSquadSeasonId}
                onChange={(event) => setSelectedSquadSeasonId(event.target.value)}
                sx={{ minWidth: 200 }}
                size="small"
                fullWidth={false}
              >
                {seasons.map((season) => (
                  <MenuItem key={season.id} value={season.id}>
                    {season.label}
                  </MenuItem>
                ))}
              </Input>
            ) : undefined
          }
        />

        {seasons.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No seasons yet — a squad is always built for a specific season.
          </Typography>
        ) : squad.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No players in this team's squad for this season yet.
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
            {squad.map((member) => (
              <SquadPlayerTile key={member.id} member={member} />
            ))}
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          <MuiButton component={RouterLink} to={editTo} variant="outlined" size="small">
            Add player
          </MuiButton>
        </Box>
      </Card>

      <RecordQuickViewDialog
        open={Boolean(selectedContact)}
        onClose={() => setOpenContactId(null)}
        avatar={{
          imageUrl: selectedContact?.contact.photoUrl,
          fallback: initialsFromName(
            selectedContact ? `${selectedContact.contact.contact.firstName} ${selectedContact.contact.contact.lastName}` : '',
          ),
          shape: 'circular',
        }}
        title={selectedContact ? `${selectedContact.contact.contact.firstName} ${selectedContact.contact.contact.lastName}` : ''}
        subtitle={selectedContact?.role}
        fields={
          selectedContact
            ? [
                { icon: <AccountTreeOutlinedIcon />, label: 'Role', value: selectedContact.role },
                { icon: <EmailOutlinedIcon />, label: 'Email', value: selectedContact.contact.contact.email },
                { icon: <PhoneOutlinedIcon />, label: 'Phone', value: selectedContact.contact.contact.phone },
              ]
            : []
        }
        editTo={selectedContact ? `/manage/club-contacts/${selectedContact.contact.id}/edit` : '/manage/club-contacts'}
      />

      <SponsorQuickViewDialog clubId={clubId} sponsor={selectedSponsor} onClose={() => setOpenSponsorId(null)} />
    </Box>
  )
}
