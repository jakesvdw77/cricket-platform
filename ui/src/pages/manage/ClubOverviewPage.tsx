import type { ReactNode } from 'react'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, IconButton, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import AddIcon from '@mui/icons-material/Add'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { SocialLinksRow } from '../../components/marketing/SocialLinksRow'
import { RecordQuickViewDialog } from '../../components/RecordQuickViewDialog'
import { badgeSx } from '../../components/RecordCard'
import { getManagedClubProfile } from '../../api/clubApi'
import type { Address, ClubProfileType } from '../../api/clubApi'
import { listClubContacts } from '../../api/clubContactApi'
import type { ClubContact } from '../../api/clubContactApi'
import { listSponsors } from '../../api/sponsorApi'
import type { Sponsor } from '../../api/sponsorApi'
import { listSections } from '../../api/sectionApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { initialsFromName } from '../../utils/initials'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { buildSectionTree } from '../../utils/sectionTree'
import type { SectionTreeNode } from '../../utils/sectionTree'
import { fullName as contactFullName } from './ClubContactList'

const CLUB_TYPE_LABELS: Record<ClubProfileType, string> = {
  CLUB: 'Club',
  ACADEMY: 'Academy',
  SCHOOL: 'School',
  OTHER: 'Other',
}

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

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`
}

// The manual "section label + optional action" header row every card on this page uses — mirrors
// ClubStructure.tsx's own convention of building this row by hand inside Card's children rather
// than Card's own `title` prop, since that prop has no room for a trailing action button.
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

// One tappable avatar icon for the Contacts/Sponsors grids — extracted once both grids turned out
// to be near-identical (image-or-initials avatar + tooltip + click-to-open-quick-view), per
// docs/standards/frontend.md's duplicate-markup threshold, rather than left as two ~20-line blocks
// differing only in shape/image field/tooltip text.
function RecordIconButton({
  imageUrl,
  shape,
  label,
  initials,
  onClick,
}: {
  imageUrl: string | null
  shape: 'circular' | 'rounded'
  label: string
  initials: string
  onClick: () => void
}) {
  return (
    <IconButton onClick={onClick} title={label} aria-label={label} sx={{ p: 0 }}>
      <Avatar
        src={imageUrl ?? undefined}
        variant={shape}
        sx={{
          width: 44,
          height: 44,
          fontSize: '0.8125rem',
          fontWeight: 600,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
          color: 'primary.dark',
        }}
      >
        {initials}
      </Avatar>
    </IconButton>
  )
}

function SectionTreeList({ nodes }: { nodes: SectionTreeNode[] }) {
  if (nodes.length === 0) {
    return null
  }
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {nodes.map((node) => (
        <Box component="li" key={node.section.id} sx={{ py: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>
            {node.section.name}
          </Typography>
          {node.children.length > 0 && (
            <Box sx={{ pl: 2 }}>
              <SectionTreeList nodes={node.children} />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}

// docs/specs/056-club-profile-overview.md: the new consolidated, view-first Club Profile overview
// — replaces the four separate Club Profile/Contacts/Sponsors/Structure dashboard cards with one
// bento-grid page. Reads clubId from ManagerHome's Outlet context, same guard/loading/error shape
// as every other /manage page — gated on the profile fetch specifically (the header needs it),
// every other list fetched independently alongside it.
export default function ClubOverviewPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const [openContactId, setOpenContactId] = useState<string | null>(null)
  const [openSponsorId, setOpenSponsorId] = useState<string | null>(null)

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

  const { data: seasons } = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
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
  const sectionTree = buildSectionTree(sections ?? [])
  const seasonList: Season[] = seasons ?? []
  const currentSeasonId = pickDefaultSeasonId(seasonList)

  const selectedContact = contactList.find((contact) => contact.id === openContactId) ?? null
  const selectedSponsor = sponsorList.find((sponsor) => sponsor.id === openSponsorId) ?? null

  const hasAddress = hasAnyAddressField(profile.address)
  const socialLinks = profile.socialLinks ?? []
  const hasSocialLinks = socialLinks.length > 0
  const hasAnyProfileField = Boolean(profile.phone || profile.email || profile.website || hasAddress || hasSocialLinks)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
        <MuiButton
          component={RouterLink}
          to="/manage"
          variant="text"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ mb: 1, ml: -1, color: 'text.secondary' }}
        >
          Back to Dashboard
        </MuiButton>

        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} flexWrap="wrap" useFlexGap>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Avatar
              src={profile.logoUrl ?? undefined}
              variant="rounded"
              sx={{
                width: 56,
                height: 56,
                flex: 'none',
                fontSize: '1.125rem',
                fontWeight: 600,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                color: 'primary.dark',
              }}
            >
              {initialsFromName(profile.name)}
            </Avatar>
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="h1" noWrap sx={{ fontWeight: 700 }}>
                {profile.name}
              </Typography>
              {profile.type && (
                <Chip size="small" variant="outlined" label={CLUB_TYPE_LABELS[profile.type]} sx={{ alignSelf: 'flex-start' }} />
              )}
            </Stack>
          </Stack>

          <MuiButton
            component={RouterLink}
            to="/manage/club-profile/edit"
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
            Edit profile
          </MuiButton>
        </Stack>
      </PageHeaderBand>

      {/* Profile card — full width, no edit button of its own; the header's "Edit profile" above
          already covers every field here. */}
      <Card>
        <CardHeaderRow title="Club Details" />
        {!hasAnyProfileField ? (
          <Typography variant="body2" color="text.secondary">
            No contact details yet. Add a phone, email, website, address, or social link from Edit profile.
          </Typography>
        ) : (
          <Box sx={{ position: 'relative', pb: hasSocialLinks ? 4 : 0 }}>
            <DetailFieldGrid>
              {profile.phone && <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value={profile.phone} />}
              {profile.email && <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value={profile.email} />}
              {profile.website && <DetailFieldRow icon={<LanguageOutlinedIcon />} label="Website" value={profile.website} />}
              {hasAddress && profile.address && (
                <DetailFieldRow icon={<PlaceOutlinedIcon />} label="Address" value={formatAddress(profile.address)} />
              )}
            </DetailFieldGrid>

            {hasSocialLinks && (
              <Box
                sx={{
                  position: 'absolute',
                  right: 12,
                  bottom: 12,
                  '& .MuiIconButton-root': {
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '50%',
                    bgcolor: 'background.paper',
                  },
                }}
              >
                <SocialLinksRow links={socialLinks} />
              </Box>
            )}
          </Box>
        )}
      </Card>

      {/* Contacts + Sponsors — two-column grid, stacking to one column at xs. */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Card>
          <CardHeaderRow
            title="Contacts"
            action={
              <MuiButton component={RouterLink} to="/manage/club-contacts" variant="text" color="inherit" size="small">
                Manage
              </MuiButton>
            }
          />
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
                    label={`${name} — ${contact.role}`}
                    initials={initialsFromName(name)}
                    onClick={() => setOpenContactId(contact.id)}
                  />
                )
              })}
            </Stack>
          )}
        </Card>

        <Card>
          <CardHeaderRow
            title="Sponsors"
            action={
              <MuiButton component={RouterLink} to="/manage/sponsors" variant="text" color="inherit" size="small">
                Manage
              </MuiButton>
            }
          />
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
                  label={`${sponsor.name} — Sponsor`}
                  initials={initialsFromName(sponsor.name)}
                  onClick={() => setOpenSponsorId(sponsor.id)}
                />
              ))}
            </Stack>
          )}
        </Card>
      </Box>

      {/* Structure + Seasons — same two-column/mobile-stack shape. */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Card>
          <CardHeaderRow
            title="Structure"
            action={
              <MuiButton component={RouterLink} to="/manage/sections" variant="text" color="inherit" size="small">
                Edit structure
              </MuiButton>
            }
          />
          {sectionTree.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No sections yet.
            </Typography>
          ) : (
            <SectionTreeList nodes={sectionTree} />
          )}
        </Card>

        <Card>
          <CardHeaderRow
            title="Seasons"
            action={
              <MuiButton
                component={RouterLink}
                to="/manage/fixtures/seasons/new"
                variant="text"
                color="inherit"
                size="small"
                startIcon={<AddIcon fontSize="small" />}
              >
                Add season
              </MuiButton>
            }
          />
          {seasonList.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No seasons yet.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {seasonList.map((season) => (
                <Stack key={season.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {season.label}
                      </Typography>
                      {season.id === currentSeasonId && <Chip size="small" label="Current" sx={badgeSx('positive')} />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateRange(season.startDate, season.endDate)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    component={RouterLink}
                    to={`/manage/fixtures/seasons/${season.id}/edit`}
                    aria-label={`Edit ${season.label}`}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      </Box>

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
