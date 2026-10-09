import { useMemo, useState } from 'react'
import { Link as RouterLink, Outlet, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, Divider, Link as MuiLink, MenuItem, Stack, Tab, Tabs, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import { avatarSx, badgeSx } from '../../../components/RecordCard'
import { EmptyState } from '../../../components/EmptyState'
import { Input } from '../../../components/Input'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { RecordIconButton } from '../../../components/RecordIconButton'
import { RecordQuickViewDialog } from '../../../components/RecordQuickViewDialog'
import { SocialLinksRow } from '../../../components/marketing/SocialLinksRow'
import { listLeagues } from '../../../api/leagueApi'
import { listSeasons } from '../../../api/seasonApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listLeagueAffiliations } from '../../../api/leagueAffiliationApi'
import { listLeagueContacts } from '../../../api/leagueContactApi'
import { leagueTeamsQueryKey, listLeagueTeams } from '../../../api/leagueTeamApi'
import { pickDefaultSeasonId } from '../../../utils/defaultSeason'
import { initialsFromName } from '../../../utils/initials'
import { badgeFor as contactBadgeFor, fullName as contactFullName } from '../../../utils/leagueContact'
import { leagueBadges } from '../leagues/leagueBadges'
import type { LeagueViewContext } from './leagueViewContext'

const LEAGUES_LIST_PATH = '/manage/fixtures/leagues'
const VIEW_TABS = [
  { segment: 'schedule', label: 'Schedule', icon: <EventOutlinedIcon fontSize="small" /> },
  { segment: 'teams', label: 'Teams', icon: <GroupsOutlinedIcon fontSize="small" /> },
  { segment: 'conditions', label: 'Conditions', icon: <DescriptionOutlinedIcon fontSize="small" /> },
] as const

// docs/specs/072-league-view-pages.md: the shared layout route for a league's Schedule, Teams and
// Conditions views. Owns the data the header and all three views need (carried over from the old
// LeagueDetailPage, docs/specs/062-league-detail-redesign.md), the selected season (kept in
// ?seasonId=), the always-visible header and the view switcher, and renders the active view through
// <Outlet context>.
export default function LeagueViewLayout() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { leagueId } = useParams<{ leagueId?: string }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [openContactId, setOpenContactId] = useState<string | null>(null)

  const {
    data: league,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
    select: (leagues) => leagues.find((candidate) => candidate.id === leagueId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const affiliationsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'affiliations'],
    queryFn: () => listLeagueAffiliations(clubId as string, leagueId as string),
    enabled: Boolean(clubId) && Boolean(leagueId),
  })

  // A league's contacts are a small, bounded collection, deliberately not paginated (docs/specs/
  // 054-league-contacts.md).
  const contactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'contacts'],
    queryFn: () => listLeagueContacts(clubId as string, leagueId as string),
    enabled: Boolean(clubId) && Boolean(leagueId),
  })

  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])

  // The effective season: ?seasonId= when it is one of the club's seasons, else the default season.
  // The default is never written to the URL; an invalid or stale id silently falls back to it.
  const seasonParam = searchParams.get('seasonId')
  const selectedSeasonId =
    seasonParam && seasons.some((season) => season.id === seasonParam)
      ? seasonParam
      : (pickDefaultSeasonId(seasons) ?? '')

  // docs/specs/070-league-teams.md: the season's registered league teams. The key extends 070's
  // league-teams key (so its invalidation still reaches it) with 'active', because this call asks
  // for active ones only and must not share a cache entry with the unfiltered list.
  const leagueTeamsQuery = useQuery({
    queryKey: [...leagueTeamsQueryKey(clubId as string, leagueId as string, selectedSeasonId), 'active'],
    queryFn: () => listLeagueTeams(clubId as string, leagueId as string, selectedSeasonId, { activeOnly: true }),
    enabled: Boolean(clubId) && Boolean(leagueId) && Boolean(selectedSeasonId),
  })

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsQuery.data ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teamsQuery.data])

  const affiliationsForSeason = useMemo(
    () => (affiliationsQuery.data ?? []).filter((affiliation) => affiliation.seasonId === selectedSeasonId),
    [affiliationsQuery.data, selectedSeasonId],
  )

  const activeLeagueTeams = useMemo(
    () => (selectedSeasonId ? (leagueTeamsQuery.data ?? []) : []),
    [leagueTeamsQuery.data, selectedSeasonId],
  )

  const seasonLabel = useMemo(
    () => seasons.find((season) => season.id === selectedSeasonId)?.label ?? '',
    [seasons, selectedSeasonId],
  )

  const handleSeasonChange = (seasonId: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('seasonId', seasonId)
        return next
      },
      { replace: true },
    )
  }

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !league) {
    return (
      <EmptyState
        title="Couldn't load this league"
        description="Something went wrong loading this league. Please try again."
      />
    )
  }

  const contacts = contactsQuery.data ?? []
  const selectedContact = contacts.find((contact) => contact.id === openContactId) ?? null
  const badges = leagueBadges(league)
  const hasLinks = Boolean(league.phone || league.email || league.website)
  const hasSocial = league.socialLinks.length > 0
  const hasContactSection = contacts.length > 0 || hasLinks || hasSocial
  const leagueBasePath = `${LEAGUES_LIST_PATH}/${league.id}`
  const activeSegment = location.pathname.split('/').filter(Boolean).pop()
  const activeTab = VIEW_TABS.some((tab) => tab.segment === activeSegment) ? activeSegment : false

  const context: LeagueViewContext = {
    clubId,
    leagueId: league.id,
    league,
    seasons,
    selectedSeasonId,
    seasonLabel,
    teamsById,
    affiliationsForSeason,
    activeLeagueTeams,
    isLoadingTeams: affiliationsQuery.isLoading || teamsQuery.isLoading || leagueTeamsQuery.isLoading,
  }

  const linkSx = { fontSize: 13, color: 'text.secondary', overflowWrap: 'anywhere' } as const
  const linkItemSx = { display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 } as const

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          {/* Row 1: Back on the left; badges then Season on the right. The right group wraps below
              Back on a narrow width and, at xs, stacks as badges row then a full-width Season. */}
          <Box
            data-testid="league-header-top-row"
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}
          >
            <MuiButton
              component={RouterLink}
              to={LEAGUES_LIST_PATH}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ml: -1, color: 'text.secondary' }}
            >
              Back to Leagues
            </MuiButton>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: { xs: 'flex-start', md: 'flex-end' },
                gap: 1.5,
                width: { xs: '100%', md: 'auto' },
                minWidth: 0,
              }}
            >
              <Stack
                direction="row"
                spacing={0.75}
                flexWrap="wrap"
                useFlexGap
                aria-label="League badges"
                sx={{ flex: { xs: '1 1 100%', md: '0 1 auto' } }}
              >
                {badges.map((badge) => (
                  <Chip
                    key={badge.label}
                    size="small"
                    label={badge.label}
                    sx={badgeSx(badge.tone)}
                  />
                ))}
              </Stack>

              {seasons.length > 0 && (
                <Input
                  select
                  label="Season"
                  value={selectedSeasonId}
                  onChange={(event) => handleSeasonChange(event.target.value)}
                  sx={{ minWidth: 130, maxWidth: { xs: 'none', md: 280 }, width: { xs: '100%', md: 'auto' } }}
                >
                  {seasons.map((season) => (
                    <MenuItem key={season.id} value={season.id}>
                      {season.label}
                    </MenuItem>
                  ))}
                </Input>
              )}
            </Box>
          </Box>

          {/* Row 2: logo + name left (wraps, never ellipsised), Edit right on the same row. */}
          <Box
            data-testid="league-header-title-row"
            sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: '1 1 auto', minWidth: 0 }}>
              <Avatar src={league.logoUrl ?? undefined} variant="rounded" sx={avatarSx(44)}>
                <EmojiEventsOutlinedIcon fontSize="small" />
              </Avatar>
              <Typography
                variant="h5"
                component="h1"
                sx={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}
              >
                {league.name}
              </Typography>
            </Box>

            <MuiButton
              component={RouterLink}
              to={`${leagueBasePath}/edit`}
              variant="outlined"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              sx={{
                flex: 'none',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                color: 'primary.dark',
                borderColor: 'transparent',
                '&:hover': {
                  borderColor: 'transparent',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                },
              }}
            >
              Edit
            </MuiButton>
          </Box>

          {hasContactSection && (
            <>
              <Divider />
              {contacts.length > 0 && (
                <Box
                  data-testid="league-header-contact-people"
                  sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                    League contacts
                  </Typography>
                  {contacts.map((contact) => (
                    <RecordIconButton
                      key={contact.id}
                      compact
                      shape="circular"
                      label={`${contactFullName(contact)} — ${contact.role}`}
                      name={contactFullName(contact)}
                      initials={initialsFromName(contactFullName(contact))}
                      onClick={() => setOpenContactId(contact.id)}
                    />
                  ))}
                </Box>
              )}

              {(hasLinks || hasSocial) && (
                <Box
                  data-testid="league-header-links-row"
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    flexWrap: 'wrap',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: hasLinks ? 'space-between' : { xs: 'flex-start', sm: 'flex-end' },
                    gap: 1,
                  }}
                >
                  {hasLinks && (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        flexWrap: 'wrap',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: { xs: 0.75, sm: 2.5 },
                        minWidth: 0,
                      }}
                    >
                      {league.phone && (
                        <Box sx={linkItemSx}>
                          <PhoneOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <MuiLink href={`tel:${league.phone}`} underline="hover" sx={linkSx}>
                            {league.phone}
                          </MuiLink>
                        </Box>
                      )}
                      {league.email && (
                        <Box sx={linkItemSx}>
                          <EmailOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <MuiLink href={`mailto:${league.email}`} underline="hover" sx={linkSx}>
                            {league.email}
                          </MuiLink>
                        </Box>
                      )}
                      {league.website && (
                        <Box sx={linkItemSx}>
                          <LanguageOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <MuiLink
                            href={league.website}
                            target="_blank"
                            rel="noopener"
                            underline="hover"
                            sx={linkSx}
                          >
                            {league.website}
                          </MuiLink>
                        </Box>
                      )}
                    </Box>
                  )}

                  {hasSocial && (
                    <Box data-testid="league-header-social" sx={{ flex: 'none' }}>
                      <SocialLinksRow links={league.socialLinks} size="small" />
                    </Box>
                  )}
                </Box>
              )}
            </>
          )}
        </Stack>
      </PageHeaderBand>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {/* The switcher is link navigation, so it is a nav landmark and the active link carries
            aria-current="page". */}
        <Box component="nav" aria-label="League views" sx={{ minWidth: 0 }}>
        <Tabs
          value={activeTab}
          variant="scrollable"
          scrollButtons={false}
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44 }}
        >
          {VIEW_TABS.map((tab) => (
            <Tab
              key={tab.segment}
              value={tab.segment}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              component={RouterLink}
              to={{ pathname: `${leagueBasePath}/${tab.segment}`, search: location.search }}
              aria-current={activeTab === tab.segment ? 'page' : undefined}
              sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}
            />
          ))}
        </Tabs>
        </Box>

        <Outlet context={context} />
      </Box>

      <RecordQuickViewDialog
        open={Boolean(selectedContact)}
        onClose={() => setOpenContactId(null)}
        avatar={{
          fallback: initialsFromName(selectedContact ? contactFullName(selectedContact) : ''),
          shape: 'circular',
        }}
        title={selectedContact ? contactFullName(selectedContact) : ''}
        subtitle={selectedContact?.role}
        fields={
          selectedContact
            ? [
                // Restores the primary/inactive signal the icon row has no badge slot for (docs/
                // specs/062-league-detail-redesign.md).
                ...(contactBadgeFor(selectedContact)
                  ? [{ icon: <StarOutlineOutlinedIcon />, label: 'Status', value: contactBadgeFor(selectedContact)!.label }]
                  : []),
                { icon: <BadgeOutlinedIcon />, label: 'Role', value: selectedContact.role },
                { icon: <EmailOutlinedIcon />, label: 'Email', value: selectedContact.contact.email },
                { icon: <PhoneOutlinedIcon />, label: 'Phone', value: selectedContact.contact.phone },
              ]
            : []
        }
        editTo={
          selectedContact
            ? `${leagueBasePath}/contacts/${selectedContact.id}/edit`
            : `${leagueBasePath}/contacts`
        }
      />
    </Box>
  )
}
