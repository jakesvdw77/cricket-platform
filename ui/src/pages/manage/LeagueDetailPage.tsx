import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, Link as MuiLink, MenuItem, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import { DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { avatarSx, badgeSx } from '../../components/RecordCard'
import type { Team } from '../../api/teamApi'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { RecordIconButton } from '../../components/RecordIconButton'
import { RecordQuickViewDialog } from '../../components/RecordQuickViewDialog'
import { LeagueFixtures } from '../../components/LeagueFixtures'
import { NextMatchCountdown } from '../../components/NextMatchCountdown'
import { ShareScheduleDialog } from '../../components/ShareScheduleDialog'
import type { ShareScheduleTeamOption } from '../../components/ShareScheduleDialog'
import { PlayingConditionsShareDialog } from '../../components/PlayingConditionsShareDialog'
import { SocialLinksRow } from '../../components/marketing/SocialLinksRow'
import { listLeagues, LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import { listTeamsForClub } from '../../api/teamApi'
import { listLeagueAffiliations } from '../../api/leagueAffiliationApi'
import { listMatches } from '../../api/matchApi'
import { getPlayingConditions } from '../../api/leaguePlayingConditionsApi'
import { listLeagueContacts } from '../../api/leagueContactApi'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { initialsFromName } from '../../utils/initials'
import { fullName as contactFullName } from '../../utils/leagueContact'
import { resolveNextMatchCountdown } from '../../utils/nextMatchCountdown'
import { generateLeagueSchedulePdf } from '../../utils/leagueSchedulePdf'
import { generateLeagueSchedulePoster } from '../../utils/leagueSchedulePoster'
import { generateLeagueScheduleIcs } from '../../utils/leagueScheduleIcs'
import { generatePlayingConditionsSummaryPdf } from '../../utils/playingConditionsSummaryPdf'
import { resolveEffectiveMaxOversPerBowler, resolvePlayingConditionsPayload } from '../../utils/playingConditions'
import { triggerDownload } from '../../utils/triggerDownload'
import { badgeFor } from './LeagueList'

// The small "section label + optional action" header row every card on this page uses — mirrors
// TeamDetailPage.tsx's/ClubOverviewPage.tsx's own identical convention (docs/specs/
// 056-club-profile-overview.md/057-team-extended-profile.md) of building this row by hand inside
// Card's children rather than Card's own `title` prop, since that prop has no room for a trailing
// action button or a leading icon.
function CardHeaderRow({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} component="div">
        {title}
      </Typography>
      {action}
    </Stack>
  )
}

// A lighter-weight grid tile than RecordCard for a context where only a logo + name + click-through
// is needed — same rationale TeamDetailPage.tsx's own SquadPlayerTile already documents for its
// Squad grid (docs/specs/062-league-detail-redesign.md): RecordCard's fixed slot order is built for
// a primary record-list unit, not a dense cross-reference grid inside another entity's detail page.
// Deliberately page-local rather than a components/** addition or an extension of RecordCard's own
// contract. No Edit action here — view-first, same as SquadPlayerTile: Edit lives one click away on
// the team's own detail page.
function LeagueTeamTile({ team }: { team: Team }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        position: 'relative',
        transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
        outline: '1px solid transparent',
        '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
      }}
    >
      <Avatar src={team.logoUrl ?? undefined} variant="rounded" sx={avatarSx(40, '0.8125rem')}>
        {initialsFromName(team.name)}
      </Avatar>
      <Typography variant="body2" fontWeight={600} noWrap sx={{ minWidth: 0 }}>
        {/* Stretched-link, same pattern as RecordCard.tsx/SquadPlayerTile (docs/specs/
            059-record-card-click-to-view.md) — position: static on the link itself so its ::after
            resolves its containing block to the outer Box above. */}
        <MuiLink
          component={RouterLink}
          to={`/manage/sections/${team.sectionId}/teams/${team.id}`}
          color="inherit"
          underline="none"
          sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}
        >
          {team.name}
        </MuiLink>
      </Typography>
    </Box>
  )
}

// docs/specs/062-league-detail-redesign.md: full restructure to the approved bespoke
// PageHeaderBand + Card grid layout, mirroring TeamDetailPage.tsx's/PlayerDetailPage.tsx's own
// posture directly — header chips under the name (no separate "Details" section for
// format/Playing XI size/age range), Schedule promoted to a visually-distinguished hero card
// directly under the header, Contacts as a tap-to-view icon row + RecordQuickViewDialog, Teams as
// a denser page-local tile grid, Playing Conditions moved to the bottom as reference material.
// Data-fetching is unchanged from the previous RecordDetailScreen-based implementation
// (docs/specs/036-view-first-record-detail-screens.md) — every useState/useQuery/useMemo/handler
// below carries over unchanged from before this rewrite.
export default function LeagueDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { leagueId } = useParams<{ leagueId?: string }>()
  const theme = useTheme()
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  // docs/specs/052-league-playing-conditions.md — a second, independent Share flow (the captain
  // summary) alongside the existing Schedule-sharing `shareOpen`/ShareScheduleDialog above; the two
  // never share state.
  const [playingConditionsShareOpen, setPlayingConditionsShareOpen] = useState(false)
  // docs/specs/062-league-detail-redesign.md: the Contacts card's own quick-view dialog state, same
  // pattern as TeamDetailPage.tsx's/ClubOverviewPage.tsx's own `openContactId`.
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

  // docs/specs/050-league-schedule-and-fixtures.md: the Fixtures section's own season-scoped match
  // list, rendered via the reusable LeagueFixtures component — reuses the existing
  // listMatches(leagueId, seasonId) filter combination, no new endpoint.
  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'matches', selectedSeasonId],
    queryFn: () => listMatches(clubId as string, { page: 0, leagueId: leagueId as string, seasonId: selectedSeasonId }),
    enabled: Boolean(clubId) && Boolean(leagueId) && Boolean(selectedSeasonId),
  })

  // docs/specs/050-league-schedule-and-fixtures.md: the selected season's own Playing Conditions
  // document, surfaced as a link in the page's shared season-picker row — mirrors LeagueList.tsx's
  // own card action, just season-scoped to whichever season is currently selected here rather than
  // only ever the club's "current" season.
  const playingConditionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'playing-conditions', selectedSeasonId],
    queryFn: () => getPlayingConditions(clubId as string, leagueId as string, selectedSeasonId),
    enabled: Boolean(clubId) && Boolean(leagueId) && Boolean(selectedSeasonId),
  })

  // docs/specs/054-league-contacts.md: the Contacts section's own contact list — a league's
  // contacts are a small, bounded collection, deliberately not paginated (same as
  // listSponsorContacts).
  const contactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'contacts'],
    queryFn: () => listLeagueContacts(clubId as string, leagueId as string),
    enabled: Boolean(clubId) && Boolean(leagueId),
  })

  useEffect(() => {
    if (!selectedSeasonId && seasonsQuery.data && seasonsQuery.data.length > 0) {
      const defaultId = pickDefaultSeasonId(seasonsQuery.data)
      if (defaultId) {
        setSelectedSeasonId(defaultId)
      }
    }
  }, [seasonsQuery.data, selectedSeasonId])

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsQuery.data ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teamsQuery.data])

  const affiliationsForSeason = (affiliationsQuery.data ?? []).filter(
    (affiliation) => affiliation.seasonId === selectedSeasonId,
  )

  // docs/specs/051-league-schedule-sharing.md: neither host page previously computed a plain
  // season label string — only selectedSeasonId was held in state. Shared by the Share Schedule
  // dialog's caption and every generator's header/footer subtitle.
  const seasonLabel = useMemo(
    () => seasonsQuery.data?.find((season) => season.id === selectedSeasonId)?.label ?? '',
    [seasonsQuery.data, selectedSeasonId],
  )

  // Computed once per match-list change (e.g. a season switch triggers a refetch), never on a
  // timer — this widget is deliberately static, per the spec's own Non-goals.
  const nextMatchCountdown = useMemo(
    () => resolveNextMatchCountdown(matchesQuery.data?.content ?? [], new Date()),
    [matchesQuery.data],
  )

  const shareTeams: ShareScheduleTeamOption[] = affiliationsForSeason.map((affiliation) => ({
    teamId: affiliation.teamId,
    teamName: teamsById.get(affiliation.teamId)?.name ?? 'Unknown team',
  }))

  const handleSharePdf = async (teamFilter: ShareScheduleTeamOption | null) => {
    const url = await generateLeagueSchedulePdf(
      matchesQuery.data?.content ?? [],
      teamsById,
      league?.name ?? '',
      seasonLabel,
      teamFilter,
    )
    window.open(url, '_blank')
  }

  const handleSharePoster = async (teamFilter: ShareScheduleTeamOption | null) => {
    const url = await generateLeagueSchedulePoster(
      matchesQuery.data?.content ?? [],
      teamsById,
      league?.name ?? '',
      seasonLabel,
      teamFilter,
      theme.palette.primary.main,
    )
    triggerDownload(url, `${league?.name ?? 'schedule'}-poster.png`)
  }

  const handleShareCalendar = async (team: ShareScheduleTeamOption) => {
    const url = generateLeagueScheduleIcs(matchesQuery.data?.content ?? [], teamsById, league?.name ?? '', seasonLabel, team)
    triggerDownload(url, `${team.teamName}-schedule.ics`)
  }

  // docs/specs/052-league-playing-conditions.md UI Requirements item 4/5 — the same "has this
  // league+season's structured Playing Conditions ever been saved" signal PlayingConditionsForm's
  // own initialValues derivation uses (maxOversPerInnings != null), shared here via
  // resolvePlayingConditionsPayload so the two host pages never state it differently.
  const playingConditionsPayload = resolvePlayingConditionsPayload(playingConditionsQuery.data)

  // A second, independent Share handler for the captain summary — never touches
  // generateLeagueSchedulePdf/handleSharePdf above, which belongs to the unrelated Schedule-sharing
  // feature.
  const handleSharePlayingConditionsPdf = async () => {
    if (!playingConditionsPayload) {
      return
    }
    const url = await generatePlayingConditionsSummaryPdf(league?.name ?? '', seasonLabel, playingConditionsPayload)
    window.open(url, '_blank')
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

  const badge = badgeFor(league)
  const matchCount = matchesQuery.data?.content.length ?? 0
  const contacts = contactsQuery.data ?? []
  const selectedContact = contacts.find((contact) => contact.id === openContactId) ?? null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
        <MuiButton
          component={RouterLink}
          to="/manage/fixtures/leagues"
          variant="text"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ mb: 1, ml: -1, color: 'text.secondary' }}
        >
          Back to Leagues
        </MuiButton>

        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} flexWrap="wrap" useFlexGap>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Avatar src={league.logoUrl ?? undefined} variant="rounded" sx={avatarSx(56)}>
              {initialsFromName(league.name)}
            </Avatar>
            <Stack spacing={0.75} sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="h1" noWrap sx={{ fontWeight: 700 }}>
                {league.name}
              </Typography>
              {/* The "chips under the name" row replacing the old "Details" section's format/
                  Playing XI size/age range fields entirely, plus a season-scoped teams/fixtures
                  count chip and the existing Active/Inactive badge (docs/specs/
                  062-league-detail-redesign.md). */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {league.format && <Chip size="small" variant="outlined" label={LEAGUE_FORMAT_LABELS[league.format]} />}
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<GroupsOutlinedIcon />}
                  label={`Playing XI: ${league.maxPlayingXiSize}`}
                />
                {(league.minAge != null || league.maxAge != null) && (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<CakeOutlinedIcon />}
                    label={`${league.minAge ?? 'Any'}–${league.maxAge ?? 'Any'}`}
                  />
                )}
                {/* Deliberately re-derived client-side from this page's own selected-season data
                    (affiliationsForSeason/matchesQuery), NOT league.currentSeasonTeamCount/
                    currentSeasonLabel — those reflect the club's own "current" season specifically,
                    which can differ from whichever season this page's own picker has selected. */}
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${affiliationsForSeason.length} team${affiliationsForSeason.length === 1 ? '' : 's'} · ${matchCount} fixture${matchCount === 1 ? '' : 's'}`}
                />
                {badge && <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} />}
              </Stack>
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            {(seasonsQuery.data ?? []).length > 0 && (
              <Input
                select
                label="Season"
                value={selectedSeasonId}
                onChange={(event) => setSelectedSeasonId(event.target.value)}
                sx={{ maxWidth: 280 }}
              >
                {(seasonsQuery.data ?? []).map((season) => (
                  <MenuItem key={season.id} value={season.id}>
                    {season.label}
                  </MenuItem>
                ))}
              </Input>
            )}

            <MuiButton
              component={RouterLink}
              to={`/manage/fixtures/leagues/${league.id}/edit`}
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
          </Stack>
        </Stack>
      </PageHeaderBand>

      {/* Schedule — the hero. Rendered immediately under the header, before every other card, and
          the only card on the page carrying a heavier primary-tinted border + soft shadow
          (docs/specs/062-league-detail-redesign.md). */}
      <Card
        sx={{
          border: '1.5px solid',
          borderColor: (t) => alpha(t.palette.primary.main, 0.2),
          boxShadow: (t) => `0 8px 24px -12px ${alpha(t.palette.primary.main, 0.35)}`,
        }}
      >
        <CardHeaderRow
          title={
            <Stack direction="row" alignItems="center" spacing={1}>
              <EventOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Schedule
              </Typography>
            </Stack>
          }
          action={
            <Button
              variant="ghost"
              size="sm"
              startIcon={<ShareOutlinedIcon fontSize="small" />}
              onClick={() => setShareOpen(true)}
            >
              Share
            </Button>
          }
        />

        {(seasonsQuery.data ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No seasons yet — matches are scheduled for a league and a specific season.
          </Typography>
        ) : (
          <Stack spacing={3}>
            <NextMatchCountdown countdown={nextMatchCountdown} teamsById={teamsById} />
            <LeagueFixtures matches={matchesQuery.data?.content ?? []} teamsById={teamsById} />
          </Stack>
        )}
      </Card>

      {/* Details + Contacts — two-column grid, stacking to one column at xs (same shape as
          ClubOverviewPage.tsx's/TeamDetailPage.tsx's Contacts+Sponsors row). */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Card>
          <CardHeaderRow title="Details" />
          {/* Mirrors SponsorDetailPage.tsx's identical phone/email/website + SocialLinksRow layout
              — position: relative anchors the absolutely-positioned social-links row, with extra
              bottom padding to clear it. Playing XI size/age range dropped — moved to the header
              chip row above. */}
          <Box sx={{ position: 'relative', pb: league.socialLinks.length > 0 ? 4 : 0 }}>
            <DetailFieldGrid>
              {league.phone && <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value={league.phone} />}
              {league.email && <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value={league.email} />}
              {league.website && (
                <DetailFieldRow icon={<LanguageOutlinedIcon />} label="Website" value={league.website} />
              )}
            </DetailFieldGrid>

            {league.socialLinks.length > 0 && (
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
                <SocialLinksRow links={league.socialLinks} />
              </Box>
            )}
          </Box>
        </Card>

        <Card>
          <CardHeaderRow title="Contacts" />
          {contacts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No contacts yet for this league.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {contacts.map((contact) => (
                <RecordIconButton
                  key={contact.id}
                  shape="circular"
                  label={`${contactFullName(contact)} — ${contact.role}`}
                  name={contactFullName(contact)}
                  initials={initialsFromName(contactFullName(contact))}
                  onClick={() => setOpenContactId(contact.id)}
                />
              ))}
            </Stack>
          )}
        </Card>
      </Box>

      {/* Teams — a denser, page-local tile grid than a full-width RecordCard grid. */}
      <Card>
        <CardHeaderRow title="Teams" />
        {(seasonsQuery.data ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No seasons yet — teams are affiliated to a league for a specific season.
          </Typography>
        ) : affiliationsForSeason.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No teams affiliated for this season yet.
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
            {affiliationsForSeason.map((affiliation) => {
              const team = teamsById.get(affiliation.teamId)
              if (!team) {
                return null
              }
              return <LeagueTeamTile key={affiliation.id} team={team} />
            })}
          </Box>
        )}
      </Card>

      {/* Playing Conditions — full-width, byte-for-byte the same content as before, now last on
          the page as reference material. */}
      <Card>
        <CardHeaderRow
          title="Playing Conditions"
          action={
            <Button
              variant="ghost"
              size="sm"
              startIcon={<ShareOutlinedIcon fontSize="small" />}
              onClick={() => setPlayingConditionsShareOpen(true)}
            >
              Share
            </Button>
          }
        />

        {!playingConditionsPayload ? (
          <Typography variant="body2" color="text.secondary">
            No Playing Conditions set for this season yet.
          </Typography>
        ) : (
          <Stack spacing={2.5}>
            <DetailFieldGrid>
              <DetailFieldRow
                icon={<SportsCricketOutlinedIcon />}
                label="Max overs per innings"
                value={playingConditionsPayload.maxOversPerInnings}
              />
              <DetailFieldRow
                icon={<BoltOutlinedIcon />}
                label="Powerplay overs"
                value={playingConditionsPayload.powerplayOvers}
              />
              <DetailFieldRow
                icon={<TimerOutlinedIcon />}
                label="Max overs per bowler"
                value={
                  playingConditionsPayload.maxOversPerBowler != null
                    ? playingConditionsPayload.maxOversPerBowler
                    : `${resolveEffectiveMaxOversPerBowler(playingConditionsPayload.maxOversPerInnings, null)} (auto)`
                }
              />
              {playingConditionsPayload.fieldingRestrictionsNotes && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <DetailFieldRow
                    icon={<NotesOutlinedIcon />}
                    label="Fielding restrictions notes"
                    value={playingConditionsPayload.fieldingRestrictionsNotes}
                  />
                </Box>
              )}
              <DetailFieldRow
                icon={<SwapHorizOutlinedIcon />}
                label="Substitutions allowed"
                value={playingConditionsPayload.allowSubstitutions ? 'Yes' : 'No'}
              />
              <DetailFieldRow
                icon={<EmojiEventsOutlinedIcon />}
                label="Points for win"
                value={playingConditionsPayload.pointsForWin}
              />
              <DetailFieldRow
                icon={<EmojiEventsOutlinedIcon />}
                label="Points for loss"
                value={playingConditionsPayload.pointsForLoss}
              />
              <DetailFieldRow
                icon={<EmojiEventsOutlinedIcon />}
                label="Points for draw"
                value={playingConditionsPayload.pointsForDraw}
              />
              <DetailFieldRow
                icon={<EmojiEventsOutlinedIcon />}
                label="Points for no result"
                value={playingConditionsPayload.pointsForNoResult}
              />
              <DetailFieldRow
                icon={<EmojiEventsOutlinedIcon />}
                label="Points for forfeit win"
                value={playingConditionsPayload.pointsForForfeitWin}
              />
              {playingConditionsPayload.bonusPointsEnabled && (
                <>
                  <DetailFieldRow
                    icon={<StarOutlineOutlinedIcon />}
                    label="Bonus — early chase"
                    value={`Before over ${playingConditionsPayload.bonusBattingOversThreshold}`}
                  />
                  <DetailFieldRow
                    icon={<StarOutlineOutlinedIcon />}
                    label="Bonus — bowling restriction"
                    value={`${playingConditionsPayload.bonusBowlingRestrictionPercentage}% of target`}
                  />
                </>
              )}
              {playingConditionsPayload.additionalNotes && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <DetailFieldRow
                    icon={<NotesOutlinedIcon />}
                    label="Additional notes"
                    value={playingConditionsPayload.additionalNotes}
                  />
                </Box>
              )}
            </DetailFieldGrid>

            {playingConditionsQuery.data?.documentUrl && (
              <Button
                variant="ghost"
                size="sm"
                startIcon={<DescriptionOutlinedIcon fontSize="small" />}
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => window.open(playingConditionsQuery.data!.documentUrl as string, '_blank')}
              >
                View full document
              </Button>
            )}
          </Stack>
        )}
      </Card>

      <ShareScheduleDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        leagueName={league.name}
        seasonLabel={seasonLabel}
        teams={shareTeams}
        onSharePdf={handleSharePdf}
        onSharePoster={handleSharePoster}
        onShareCalendar={handleShareCalendar}
      />

      <PlayingConditionsShareDialog
        open={playingConditionsShareOpen}
        onClose={() => setPlayingConditionsShareOpen(false)}
        hasStructuredFields={Boolean(playingConditionsPayload)}
        leagueName={league.name}
        seasonLabel={seasonLabel}
        conditions={playingConditionsPayload}
        onSharePdf={handleSharePlayingConditionsPdf}
      />

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
                { icon: <BadgeOutlinedIcon />, label: 'Role', value: selectedContact.role },
                { icon: <EmailOutlinedIcon />, label: 'Email', value: selectedContact.contact.email },
                { icon: <PhoneOutlinedIcon />, label: 'Phone', value: selectedContact.contact.phone },
              ]
            : []
        }
        editTo={
          selectedContact
            ? `/manage/fixtures/leagues/${leagueId}/contacts/${selectedContact.id}/edit`
            : `/manage/fixtures/leagues/${leagueId}/contacts`
        }
      />
    </Box>
  )
}
