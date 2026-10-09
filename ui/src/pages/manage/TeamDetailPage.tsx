import { useMemo, useState } from 'react'
import { Link as RouterLink, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
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
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined'
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined'
import { EmptyState } from '../../components/EmptyState'
import { HeaderSeasonSelect } from '../../components/HeaderSeasonSelect'
import { InfoCard } from '../../components/InfoCard'
import { KeyFigureTile } from '../../components/KeyFigureTile'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { RecordQuickViewDialog } from '../../components/RecordQuickViewDialog'
import { RecordIconButton } from '../../components/RecordIconButton'
import { SponsorQuickViewDialog } from '../../components/SponsorQuickViewDialog'
import { SocialLinksRow } from '../../components/marketing/SocialLinksRow'
import { avatarSx, badgeSx } from '../../components/RecordCard'
import { playerAvatarSrc } from '../../components/BrandIcon'
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

const NOT_ON_FILE = '–'

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
        <Avatar src={playerAvatarSrc(member.photoUrl, member.gender)} variant="circular" sx={avatarSx(40, '0.8125rem')}>
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

// docs/specs/092 (C): the team page on the Leagues / Player / Poll standard. Header: Back, the Season pill (no "All") and
// the filled Edit team on the top row; logo, name and section + status chips; the ground and social links on one line.
// A key-figure strip follows, then Contacts and Sponsors cards of equal height and the Squad card. The Season pill (from
// ?seasonId=, else the default season) drives the squad, the player count, the captain and the match count.
//
// Back-navigation: `?from=section` (set by the section-scoped Teams list) routes Back to that list; absent (the
// club-wide directory, a bookmark, a typed URL) routes Back to the club-wide Teams directory.
export default function TeamDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { sectionId, teamId } = useParams<{ sectionId?: string; teamId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const fromSection = searchParams.get('from') === 'section'
  const [openContactId, setOpenContactId] = useState<string | null>(null)
  const [openSponsorId, setOpenSponsorId] = useState<string | null>(null)

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

  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])

  // The effective season: ?seasonId= when it is one of the club's seasons, else the default season. The default is
  // never written to the URL; an invalid or stale id silently falls back to it.
  const seasonParam = searchParams.get('seasonId')
  const selectedSeasonId =
    seasonParam && seasons.some((season) => season.id === seasonParam)
      ? seasonParam
      : (pickDefaultSeasonId(seasons) ?? '')

  const handleSeasonChange = (seasonId: string | null) => {
    if (!seasonId) {
      return
    }
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('seasonId', seasonId)
        return next
      },
      { replace: true },
    )
  }

  const squadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', selectedSeasonId, 'squad'],
    queryFn: () => listSquad(clubId as string, teamId as string, selectedSeasonId),
    enabled: Boolean(clubId) && Boolean(teamId) && Boolean(selectedSeasonId),
  })

  // docs/specs/057-team-extended-profile.md's Non-goals: no new "matches" backend field - computed client-side from the
  // club's matches of the chosen season, filtered to this team's home/away id, same posture useTeamCardData.ts uses.
  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', 'team-detail-season', selectedSeasonId],
    queryFn: () => listMatches(clubId as string, { page: 0, size: 200, seasonId: selectedSeasonId }),
    enabled: Boolean(clubId) && Boolean(selectedSeasonId),
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

  // Sorted by name regardless of the server's own row order, so the grid does not visibly reshuffle.
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

  const selectedContact = contacts.find((teamContact) => teamContact.id === openContactId) ?? null
  const selectedSponsor = sponsors.find((sponsor) => sponsor.id === openSponsorId) ?? null
  const status = badgeFor(team) ?? { label: 'Active', tone: 'positive' as const }
  const hasSocial = team.socialLinks.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          {/* Top row: Back on the left; the Season pill and the filled primary Edit team on the right. */}
          <Box
            data-testid="team-header-top-row"
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}
          >
            <MuiButton
              component={RouterLink}
              to={backTo}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ml: -1, color: 'text.secondary' }}
            >
              {backLabel}
            </MuiButton>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, flex: 'none' }}>
              {seasons.length > 0 && (
                <HeaderSeasonSelect
                  seasons={seasons.map((season) => ({ id: season.id, name: season.label }))}
                  value={selectedSeasonId || null}
                  onChange={handleSeasonChange}
                  showAll={false}
                />
              )}
              <MuiButton component={RouterLink} to={editTo} variant="contained" startIcon={<EditOutlinedIcon fontSize="small" />}>
                Edit team
              </MuiButton>
            </Box>
          </Box>

          {/* Title row: logo tile and name (wraps), then the section and status chips under it. */}
          <Box data-testid="team-header-title-row" sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 }, minWidth: 0 }}>
            <Avatar
              src={team.logoUrl ?? undefined}
              variant="rounded"
              sx={{ ...avatarSx(64), width: { xs: 52, md: 64 }, height: { xs: 52, md: 64 }, borderRadius: 1.5 }}
            >
              {initialsFromName(team.name)}
            </Avatar>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '1.4rem', md: '1.75rem' }, overflowWrap: 'anywhere' }}
              >
                {team.name}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap aria-label="Team badges">
                <Chip size="small" icon={<AccountTreeOutlinedIcon />} variant="outlined" label={sectionBreadcrumb} />
                <Chip size="small" label={status.label} sx={badgeSx(status.tone)} />
              </Stack>
            </Stack>
          </Box>

          {(team.groundName || hasSocial) && (
            <Box
              data-testid="team-header-info-line"
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2.5, rowGap: 1 }}
            >
              {team.groundName && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <PlaceOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', overflowWrap: 'anywhere' }}>{team.groundName}</Typography>
                </Box>
              )}
              {hasSocial && (
                <Box data-testid="team-header-social" sx={{ flex: 'none', ml: { sm: 'auto' } }}>
                  <SocialLinksRow links={team.socialLinks} size="small" />
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </PageHeaderBand>

      <Box
        data-testid="team-key-figures"
        sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
      >
        <KeyFigureTile
          testId="team-figure-players"
          icon={<GroupsOutlinedIcon />}
          value={String(playerCount)}
          label="Players in squad"
        />
        <KeyFigureTile
          testId="team-figure-matches"
          icon={<EventOutlinedIcon />}
          value={String(matchCount)}
          label="Matches this season"
        />
        <KeyFigureTile
          testId="team-figure-captain"
          icon={<MilitaryTechOutlinedIcon />}
          value={captainName ?? NOT_ON_FILE}
          label="Captain"
          textValue
        />
        <KeyFigureTile
          testId="team-figure-ground"
          icon={<PlaceOutlinedIcon />}
          value={team.groundName || NOT_ON_FILE}
          label="Ground"
          textValue
        />
      </Box>

      {/* Contacts + Sponsors: equal-height cards (InfoCard fills its grid cell), one column on a phone. */}
      <Box
        data-testid="team-contacts-sponsors-row"
        sx={{ display: 'grid', alignItems: 'stretch', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}
      >
        <InfoCard testId="team-contacts-card" title="Contacts" icon={<ContactsOutlinedIcon />}>
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
        </InfoCard>

        <InfoCard testId="team-sponsors-card" title="Sponsors" icon={<HandshakeOutlinedIcon />}>
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
        </InfoCard>
      </Box>

      {/* Full-width Squad card for the pill's season. "Add player" goes to the edit screen's Squad tab, the one place
          squad membership is mutated (docs/specs/036-view-first-record-detail-screens.md). */}
      <InfoCard
        testId="team-squad-card"
        title="Squad"
        icon={<GroupsOutlinedIcon />}
        actions={
          <MuiButton component={RouterLink} to={editTo} variant="outlined" size="small">
            Add player
          </MuiButton>
        }
      >
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
      </InfoCard>

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
