import { useMemo, useState } from 'react'
import { LogoAvatar } from '../../components/LogoAvatar'
import { Link as RouterLink, useLocation, useOutletContext, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useBackLink } from '../../hooks/useReturnTo'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined'
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined'
import { EmptyState } from '../../components/EmptyState'
import { HeaderSeasonSelect } from '../../components/HeaderSeasonSelect'
import { InfoCard } from '../../components/InfoCard'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { PageCounters } from '../../components/PageCounters'
import { Button } from '../../components/Button'
import { HeaderActions } from '../../components/HeaderShareButton'
import { TeamActionsMenu } from '../../components/TeamActionsMenu'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import { RecordQuickViewDialog } from '../../components/RecordQuickViewDialog'
import { RecordIconButton } from '../../components/RecordIconButton'
import { SponsorQuickViewDialog } from '../../components/SponsorQuickViewDialog'
import { SocialLinksRow } from '../../components/marketing/SocialLinksRow'
import { badgeSx } from '../../components/RecordCard'
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
        <LogoAvatar src={playerAvatarSrc(member.photoUrl, member.gender)} variant="circular" size={40} fontSize="0.8125rem" kind="person" keepTile={!member.photoUrl}>
          {initialsFromName(playerName)}
        </LogoAvatar>
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
  const location = useLocation()
  const navigate = useNavigate()
  const fromSection = searchParams.get('from') === 'section'
  // docs/specs/127: a returnTo in the address overrides the default Back.
  const back = useBackLink(fromSection ? `/manage/sections/${sectionId}/teams` : '/manage/teams', 'Back to Teams')
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

  const backTo = back.to ?? '/manage/teams'
  const backLabel = back.label
  const editTo = `/manage/sections/${sectionId}/teams/${team.id}/edit`
  const statsPath = `/manage/teams/${team.id}/stats?seasonId=${encodeURIComponent(selectedSeasonId)}`

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
      <ManageScreenHeader
        title={team.name}
        backTo={backTo}
        backLabel={backLabel}
        // docs/specs/142: the logo, the ONE status badge and the Season pill (no "All") sit beside the name, as on a league.
        titleAdornment={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <LogoAvatar src={team.logoUrl} variant="rounded" size={40}>
              {initialsFromName(team.name)}
            </LogoAvatar>
            <Chip size="small" label={status.label} sx={badgeSx(status.tone)} data-testid="team-status-badge" />
            {seasons.length > 0 && (
              <HeaderSeasonSelect
                seasons={seasons.map((season) => ({ id: season.id, name: season.label }))}
                value={selectedSeasonId || null}
                onChange={handleSeasonChange}
                showAll={false}
              />
            )}
          </Box>
        }
        // The section path as the plain sub-header line, with the team's social links at its right (docs/specs/142).
        subtitle={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={600} color="text.primary" component="span">
              {sectionBreadcrumb}
            </Typography>
            {hasSocial && (
              <Box data-testid="team-header-social" sx={{ flex: 'none' }}>
                <SocialLinksRow links={team.socialLinks} size="small" />
              </Box>
            )}
          </Box>
        }
        // ONE filled Manage Team menu, with View Stats beside it so it is not missed (as Share is on a result).
        action={
          <HeaderActions
            beside={
              <Button size="compact" variant="secondary" startIcon={<EqualizerOutlinedIcon />} onClick={() => navigate(withReturnTo(statsPath, currentOrigin(location), 'Team'))} data-testid="team-view-stats">
                View Stats
              </Button>
            }
          >
            <TeamActionsMenu trigger="button" teamName={team.name} editTo={editTo} statsTo={statsPath} originLabel="Team" />
          </HeaderActions>
        }
      />

      <PageCounters
        density="compact"
        items={[
          { id: 'players', testId: 'team-figure-players', value: String(playerCount), label: 'Players In Squad', shortLabel: 'Players' },
          { id: 'matches', testId: 'team-figure-matches', value: String(matchCount), label: 'Matches This Season', shortLabel: 'Matches' },
          { id: 'captain', testId: 'team-figure-captain', value: captainName ?? NOT_ON_FILE, label: 'Captain' },
          { id: 'ground', testId: 'team-figure-ground', value: team.groundName || NOT_ON_FILE, label: 'Ground' },
        ]}
      />

      {/* Contacts + Sponsors: equal-height cards (InfoCard fills its grid cell), one column on a phone. */}
 <Box
        data-testid="team-cards-grid"
        sx={{ display: 'grid', alignItems: 'stretch', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}
      >
        <Box sx={{ gridColumn: { lg: 3 }, gridRow: { lg: 1 }, '& > *': { height: '100%' } }}>
        <InfoCard flat testId="team-contacts-card" title="Contacts" icon={<ContactsOutlinedIcon />}>
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
        </Box>

        <Box sx={{ gridColumn: { lg: 3 }, gridRow: { lg: 2 }, '& > *': { height: '100%' } }}>
        <InfoCard flat testId="team-sponsors-card" title="Sponsors" icon={<HandshakeOutlinedIcon />}>
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
        <Box id="squad" sx={{ gridColumn: { md: '1 / -1', lg: '1 / span 2' }, gridRow: { lg: '1 / span 2' }, '& > *': { height: '100%' } }}>
      <InfoCard
        flat
        testId="team-squad-card"
        title="Squad"
        icon={<GroupsOutlinedIcon />}
        actions={
          <Button size="compact" variant="secondary" onClick={() => navigate(editTo)}>
            Add Player
          </Button>
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
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' } }}>
            {squad.map((member) => (
              <SquadPlayerTile key={member.id} member={member} />
            ))}
          </Box>
        )}
      </InfoCard>
        </Box>
      </Box>

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
