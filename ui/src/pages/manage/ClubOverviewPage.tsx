import { useMemo, useState } from 'react'
import { Link as RouterLink, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, IconButton, Stack, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import OpenInFullOutlinedIcon from '@mui/icons-material/OpenInFullOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import { EmptyState } from '../../components/EmptyState'
import { InfoCard } from '../../components/InfoCard'
import { KeyFigureTile } from '../../components/KeyFigureTile'
import { OrgChartFullScreen } from '../../components/OrgChartFullScreen'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { SocialLinksRow } from '../../components/marketing/SocialLinksRow'
import { RecordQuickViewDialog } from '../../components/RecordQuickViewDialog'
import { RecordIconButton } from '../../components/RecordIconButton'
import { avatarSx } from '../../components/RecordCard'
import { SectionInfoPanel } from '../../components/SectionInfoPanel'
import { SectionOrgChart } from '../../components/SectionOrgChart'
import { SectionTree } from '../../components/SectionTree'
import { SidePanel } from '../../components/SidePanel'
import { getManagedClubProfile } from '../../api/clubApi'
import type { Address, ClubProfileType } from '../../api/clubApi'
import { listClubContacts } from '../../api/clubContactApi'
import type { ClubContact } from '../../api/clubContactApi'
import { listSponsors } from '../../api/sponsorApi'
import type { Sponsor } from '../../api/sponsorApi'
import { getSectionsSummary, listSectionContacts, listSections, sectionsSummaryKey } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { listSeasons } from '../../api/seasonApi'
import { listTeamsForSection } from '../../api/teamApi'
import { initialsFromName } from '../../utils/initials'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { fullName as contactFullName } from './ClubContactList'

const CLUB_TYPE_LABELS: Record<ClubProfileType, string> = {
  CLUB: 'Club',
  ACADEMY: 'Academy',
  SCHOOL: 'School',
  OTHER: 'Other',
}

const DASH = '\u2013'

function hasAnyAddressField(address: Address | null | undefined): boolean {
  if (!address) {
    return false
  }
  return Boolean(address.number || address.street || address.city || address.provinceState || address.country || address.postalCode)
}

function formatAddress(address: Address): string {
  return [
    [address.number, address.street].filter(Boolean).join(' ').trim(),
    address.city,
    address.provinceState,
    address.postalCode,
    address.country,
  ]
    .filter((part) => Boolean(part && part.trim()))
    .join(', ')
}

// docs/specs/094-club-structure-and-seasons.md Slice A (docs/specs/056-club-profile-overview.md is the page it
// rewrites): the Club profile. A header (logo, name, type, filled Edit profile), a three-tile key-figure strip, equal-height
// Details / Contacts / Sponsors cards, then the "Club structure" card with the org chart (a nested list on a phone) and
// the read-only detail card for the selected section. Reads clubId from ManagerHome's Outlet context, same guard/loading/
// error shape as every other /manage page, gated on the profile fetch; every other query is independent and never blocks.
export default function ClubOverviewPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [openContactId, setOpenContactId] = useState<string | null>(null)
  const [openSponsorId, setOpenSponsorId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId as string),
    enabled: Boolean(clubId),
  })

  const { data: contacts } = useQuery({
    queryKey: ['managed-club', clubId, 'contacts'],
    queryFn: () => listClubContacts(clubId as string),
    enabled: Boolean(clubId),
  })

  const { data: sponsors } = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors'],
    queryFn: () => listSponsors(clubId as string),
    enabled: Boolean(clubId),
  })

  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })
  const seasons = seasonsQuery.data
  const seasonId = useMemo(() => (seasons ? pickDefaultSeasonId(seasons) : undefined), [seasons])
  const seasonLabel = seasons?.find((season) => season.id === seasonId)?.label ?? 'the current season'

  // One request for the key figures and every section's panel figures; held until the seasons are known so the first
  // request already names the season. Under the sections key prefix, so creating a section refreshes it.
  const summaryQuery = useQuery({
    queryKey: sectionsSummaryKey(clubId as string, seasonId),
    queryFn: () => getSectionsSummary(clubId as string, { seasonId }),
    enabled: Boolean(clubId) && !seasonsQuery.isPending,
  })

  const sectionList: Section[] = useMemo(() => sections ?? [], [sections])
  const selectedSection = sectionList.find((section) => section.id === selectedId) ?? null
  const activeSelectedId = selectedSection?.id

  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections', activeSelectedId, 'teams'],
    queryFn: () => listTeamsForSection(clubId as string, activeSelectedId as string),
    enabled: Boolean(clubId) && Boolean(activeSelectedId),
  })

  const sectionContactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections', activeSelectedId, 'contacts'],
    queryFn: () => listSectionContacts(clubId as string, activeSelectedId as string),
    enabled: Boolean(clubId) && Boolean(activeSelectedId),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !profile) {
    return (
      <EmptyState
        title="Couldn't load your club"
        description="Something went wrong loading your club's profile. Please try again."
      />
    )
  }

  const contactList: ClubContact[] = contacts ?? []
  const sponsorList: Sponsor[] = sponsors ?? []

  const selectedContact = contactList.find((contact) => contact.id === openContactId) ?? null
  const selectedSponsor = sponsorList.find((sponsor) => sponsor.id === openSponsorId) ?? null

  const hasAddress = hasAnyAddressField(profile.address)
  const socialLinks = profile.socialLinks ?? []
  const hasSocialLinks = socialLinks.length > 0
  const hasAnyProfileField = Boolean(profile.phone || profile.email || profile.website || hasAddress || hasSocialLinks)

  // The summary has no club-level leagues figure, so Leagues is the distinct league ids across every section's leagues.
  const summary = summaryQuery.data
  const leagueCount = summary ? new Set(summary.sections.flatMap((row) => row.leagues.map((league) => league.id))).size : 0
  const figure = (value: number | undefined) => (value === undefined ? DASH : String(value))

  const clearSelection = () => setSelectedId(null)

  const panelFor = (section: Section) => (
    <SectionInfoPanel
      section={section}
      sections={sectionList}
      summary={summary?.sections.find((row) => row.sectionId === section.id)}
      seasonLabel={seasonLabel}
      teams={teamsQuery.data ?? []}
      contacts={sectionContactsQuery.data ?? []}
      teamsLoading={teamsQuery.isLoading}
      contactsLoading={sectionContactsQuery.isLoading}
      error={summaryQuery.isError || teamsQuery.isError || sectionContactsQuery.isError}
      onRetry={() => {
        void summaryQuery.refetch()
        void teamsQuery.refetch()
        void sectionContactsQuery.refetch()
      }}
      onClose={clearSelection}
      embedded
      onSelectSection={setSelectedId}
      editTo={`/manage/sections?sectionId=${section.id}`}
      manageTeamsTo={`/manage/sections/${section.id}/teams`}
      teamTo={(team) => `/manage/sections/${team.sectionId}/teams/${team.id}`}
      leagueTo={(league) => `/manage/fixtures/leagues/${league.id}`}
    />
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1" fontWeight={700}>
            Club profile
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 }, minWidth: 0 }}>
              <Avatar
                src={profile.logoUrl ?? undefined}
                variant="rounded"
                sx={{ ...avatarSx(64), borderRadius: 1.5 }}
              >
                {initialsFromName(profile.name)}
              </Avatar>
              <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Typography
                  variant="h6"
                  component="h2"
                  sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '1.25rem', md: '1.5rem' }, overflowWrap: 'anywhere' }}
                >
                  {profile.name}
                </Typography>
                {profile.type && (
                  <Chip size="small" variant="outlined" label={CLUB_TYPE_LABELS[profile.type]} sx={{ alignSelf: 'flex-start' }} />
                )}
              </Stack>
            </Box>
            <MuiButton
              component={RouterLink}
              to="/manage/club-profile/edit"
              variant="contained"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              sx={{ flex: 'none' }}
            >
              Edit profile
            </MuiButton>
          </Box>
        </Stack>
      </PageHeaderBand>

      {!summaryQuery.isError && (
        <Box
          data-testid="club-key-figures"
          sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}
        >
          <KeyFigureTile testId="club-figure-teams" icon={<GroupsOutlinedIcon />} value={figure(summary?.totals.teams)} label="Teams" />
          <KeyFigureTile
            testId="club-figure-leagues"
            icon={<EmojiEventsOutlinedIcon />}
            value={figure(summary ? leagueCount : undefined)}
            label="Leagues"
          />
          <KeyFigureTile testId="club-figure-players" icon={<PeopleOutlineIcon />} value={figure(summary?.totals.players)} label="Players" />
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.75, md: 2 },
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          alignItems: 'stretch',
        }}
      >
        {/* Manage opens the same edit form as the header's "Edit profile". */}
        <InfoCard
          title="Club Details"
          icon={<BusinessOutlinedIcon />}
          headerAction={
            <MuiButton component={RouterLink} to="/manage/club-profile/edit" variant="text" color="inherit" size="small">
              Manage
            </MuiButton>
          }
        >
          {!hasAnyProfileField ? (
            <Typography variant="body2" color="text.secondary">
              No contact details yet. Add a phone, email, website, address, or social link from Edit profile.
            </Typography>
          ) : (
            <>
              <DetailFieldGrid>
                {profile.phone && <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value={profile.phone} />}
                {profile.email && <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value={profile.email} />}
                {profile.website && <DetailFieldRow icon={<LanguageOutlinedIcon />} label="Website" value={profile.website} />}
                {hasAddress && profile.address && (
                  <DetailFieldRow icon={<PlaceOutlinedIcon />} label="Address" value={formatAddress(profile.address)} />
                )}
              </DetailFieldGrid>
              {hasSocialLinks && <SocialLinksRow links={socialLinks} />}
            </>
          )}
        </InfoCard>

        <InfoCard
          title="Contacts"
          icon={<ContactsOutlinedIcon />}
          headerAction={
            <MuiButton component={RouterLink} to="/manage/club-contacts" variant="text" color="inherit" size="small">
              Manage
            </MuiButton>
          }
        >
          {contactList.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No contacts yet.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {contactList.map((contact) => {
                const name = contactFullName(contact)
                return (
                  <RecordIconButton
                    key={contact.id}
                    imageUrl={contact.photoUrl}
                    shape="circular"
                    label={`${name} \u2014 ${contact.role}`}
                    name={name}
                    initials={initialsFromName(name)}
                    onClick={() => setOpenContactId(contact.id)}
                  />
                )
              })}
            </Stack>
          )}
        </InfoCard>

        <InfoCard
          title="Sponsors"
          icon={<HandshakeOutlinedIcon />}
          headerAction={
            <MuiButton component={RouterLink} to="/manage/sponsors" variant="text" color="inherit" size="small">
              Manage
            </MuiButton>
          }
        >
          {sponsorList.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No sponsors yet.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {sponsorList.map((sponsor) => (
                <RecordIconButton
                  key={sponsor.id}
                  imageUrl={sponsor.logoUrl}
                  shape="rounded"
                  label={`${sponsor.name} \u2014 Sponsor`}
                  name={sponsor.name}
                  initials={initialsFromName(sponsor.name)}
                  onClick={() => setOpenSponsorId(sponsor.id)}
                />
              ))}
            </Stack>
          )}
        </InfoCard>
      </Box>

      <InfoCard
        title="Club structure"
        icon={<AccountTreeOutlinedIcon />}
        testId="club-structure-card"
        headerAction={
          <Stack direction="row" spacing={0.5} alignItems="center">
            {!isPhone && sectionList.length > 0 && (
              <IconButton aria-label="Expand club structure" size="small" onClick={() => setExpanded(true)}>
                <OpenInFullOutlinedIcon fontSize="small" />
              </IconButton>
            )}
            <MuiButton component={RouterLink} to="/manage/sections" variant="text" color="inherit" size="small">
              Manage
            </MuiButton>
          </Stack>
        }
      >
        {sectionList.length === 0 ? (
          <EmptyState
            title="No sections yet"
            description="Set up your club's structure, for example Seniors and Juniors, to organise teams and players."
            action={
              <MuiButton component={RouterLink} to="/manage/sections" variant="contained">
                Set up your structure
              </MuiButton>
            }
          />
        ) : isPhone ? (
          <SectionTree
            sections={sectionList}
            selectedId={activeSelectedId ?? null}
            onSelect={setSelectedId}
            showAgeChip
          />
        ) : (
          <SectionOrgChart
            sections={sectionList}
            selectedId={activeSelectedId ?? null}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
            onClearSelection={clearSelection}
          />
        )}
      </InfoCard>

      {/* The same read-only chart, full screen with zoom and fit. A node opens the same details drawer on top of it. */}
      <OrgChartFullScreen open={expanded && !isPhone} onClose={() => setExpanded(false)} title="Club structure">
        <SectionOrgChart
          sections={sectionList}
          selectedId={activeSelectedId ?? null}
          onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
          onClearSelection={clearSelection}
        />
      </OrgChartFullScreen>

      {/* The details slide in: a right drawer from sm up, a bottom sheet on a phone. Closing it (Escape, backdrop, the close
          button) clears the selection, and focus returns to the node. */}
      <SidePanel
        open={Boolean(selectedSection)}
        onClose={clearSelection}
        title={selectedSection?.name ?? ''}
        closeLabel="Close section details"
      >
        {() => selectedSection && panelFor(selectedSection)}
      </SidePanel>

      <RecordQuickViewDialog
        open={Boolean(selectedContact)}
        onClose={() => setOpenContactId(null)}
        avatar={{
          imageUrl: selectedContact?.photoUrl,
          fallback: initialsFromName(selectedContact ? contactFullName(selectedContact) : ''),
          shape: 'circular',
        }}
        title={selectedContact ? contactFullName(selectedContact) : ''}
        subtitle={selectedContact?.role}
        fields={
          selectedContact
            ? [
                { icon: <EmailOutlinedIcon />, label: 'Email', value: selectedContact.contact.email },
                { icon: <PhoneOutlinedIcon />, label: 'Phone', value: selectedContact.contact.phone },
              ]
            : []
        }
        editTo={selectedContact ? `/manage/club-contacts/${selectedContact.id}/edit` : '/manage/club-contacts'}
      />

      <RecordQuickViewDialog
        open={Boolean(selectedSponsor)}
        onClose={() => setOpenSponsorId(null)}
        avatar={{
          imageUrl: selectedSponsor?.logoUrl,
          fallback: initialsFromName(selectedSponsor ? selectedSponsor.name : ''),
          shape: 'rounded',
        }}
        title={selectedSponsor ? selectedSponsor.name : ''}
        fields={
          selectedSponsor
            ? [
                { icon: <LanguageOutlinedIcon />, label: 'Website', value: selectedSponsor.website ?? 'Not set' },
                { icon: <EmailOutlinedIcon />, label: 'Email', value: selectedSponsor.email ?? 'Not set' },
              ]
            : []
        }
        editTo={selectedSponsor ? `/manage/sponsors/${selectedSponsor.id}/edit` : '/manage/sponsors'}
      />
    </Box>
  )
}
