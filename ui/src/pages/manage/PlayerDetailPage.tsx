import { useMemo, useState } from 'react'
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { avatarSx, badgeSx } from '../../components/RecordCard'
import { playerAvatarSrc } from '../../components/BrandIcon'
import { PlayerStatusMenu } from '../../components/PlayerStatusMenu'
import { EmptyState } from '../../components/EmptyState'
import { listPlayers, listPlayerSections } from '../../api/playerApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { useAvailabilitySeason } from '../../hooks/useAvailabilitySeason'
import { usePlayerStatusActions } from '../../hooks/usePlayerStatusActions'
import { initialsFromName } from '../../utils/initials'
import { ageFromDateOfBirth, formatDateOfBirth } from '../../utils/playerFormat'
import { playerStatusBadge, playerStatusOf } from '../../utils/playerStatus'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { GENDER_LABEL, BATTING_STANCE_LABEL, BOWLING_ARM_LABEL, BOWLING_TYPE_LABEL } from '../../utils/playerLabels'
import { fullName } from './PlayerList'
import { PlayerKeyFigures } from './playerDetail/PlayerKeyFigures'
import { InfoCard } from '../../components/InfoCard'
import type { InfoCardChip } from '../../components/InfoCard'

// docs/specs/060-player-detail-redesign.md: rebuilds this screen on TeamDetailPage.tsx's own
// bespoke header + two-column card grid pattern, replacing the generic RecordDetailScreen stacked-
// section layout. Data-fetching is unchanged from the previous RecordDetailScreen-based
// implementation (docs/specs/036-view-first-record-detail-screens.md) — listPlayers (client-side
// find-by-id, no single-player GET exists), listPlayerSections, listSections, and the
// fullName helper imported from PlayerList.tsx. docs/specs/088: the status badge, the Status button and, for an
// unverified or rejected player, a banner above the cards.
export default function PlayerDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { playerId } = useParams<{ playerId?: string }>()
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null)
  const statusActions = usePlayerStatusActions(clubId)
  // docs/specs/088 section G: the games counts come from the list endpoint, and "this season" needs the season
  const { seasonId, seasonsLoading } = useAvailabilitySeason(clubId)

  const {
    data: player,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'players', 'detail', seasonId],
    queryFn: () => listPlayers(clubId as string, { seasonId }),
    enabled: Boolean(clubId) && !seasonsLoading,
    select: (players) => players.find((candidate) => candidate.id === playerId),
  })

  const playerSectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'players', playerId, 'sections'],
    queryFn: () => listPlayerSections(clubId as string, playerId as string),
    enabled: Boolean(clubId) && Boolean(playerId),
  })

  const clubSectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

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

  if (isPending) {
    return null
  }

  if (isError || !player) {
    return (
      <EmptyState
        title="Couldn't load this player"
        description="Something went wrong loading this player. Please try again."
      />
    )
  }

  const taggedSections = playerSectionsQuery.data ?? []
  const status = playerStatusOf(player)
  const badge = playerStatusBadge(status)
  const age = ageFromDateOfBirth(player.dateOfBirth)
  const dateOfBirthText = player.dateOfBirth
    ? `${formatDateOfBirth(player.dateOfBirth)}${age != null ? ` · ${age} yrs` : ''}`
    : null
  const bowling = [
    player.bowlingArm ? BOWLING_ARM_LABEL[player.bowlingArm] : null,
    player.bowlingType ? BOWLING_TYPE_LABEL[player.bowlingType] : null,
  ].filter((part): part is string => Boolean(part))
  // All three always show, so the card keeps its shape; one with nothing on file is drawn dashed and muted.
  const cricketChips: InfoCardChip[] = [
    {
      label: `Bats: ${player.battingStance ? BATTING_STANCE_LABEL[player.battingStance] : '–'}`,
      on: Boolean(player.battingStance),
    },
    { label: `Bowls: ${bowling.length > 0 ? bowling.join(', ') : '–'}`, on: bowling.length > 0 },
    { label: `Wicketkeeper: ${player.isWicketKeeper ? 'Yes' : 'No'}`, on: player.isWicketKeeper },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
        <MuiButton
          component={RouterLink}
          to="/manage/players"
          variant="text"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ mb: 1, ml: -1, color: 'text.secondary' }}
        >
          Back to Players
        </MuiButton>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1.75, md: 2 }} sx={{ minWidth: 0 }}>
            <Avatar
              src={playerAvatarSrc(player.photoUrl, player.gender)}
              variant="circular"
              sx={(theme) => ({
                ...avatarSx(80, '1.6rem'),
                boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.18)}`,
                [theme.breakpoints.down('md')]: { width: 72, height: 72, fontSize: '1.4rem' },
              })}
            >
              {initialsFromName(fullName(player))}
            </Avatar>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '1.4rem', md: '1.75rem' }, overflowWrap: 'anywhere' }}
              >
                {fullName(player)}
              </Typography>
              {/* The status badge first, then the player's tagged sections (docs/specs/060, 088). */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="player-status-badge" />
                {taggedSections.map((section) => (
                  <Chip key={section.id} size="small" variant="outlined" label={sectionPath(section)} />
                ))}
              </Stack>
            </Stack>
          </Stack>

          {/* Side by side on the right on a desktop; two full-width halves under the header on a phone. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'auto auto' },
              gap: 1,
              width: { xs: '100%', md: 'auto' },
              '& .MuiButton-root': { minHeight: { xs: 44, md: 40 } },
            }}
          >
            <MuiButton
              variant="outlined"
              aria-haspopup="menu"
              startIcon={<ManageAccountsOutlinedIcon fontSize="small" />}
              onClick={(event) => setStatusAnchor(event.currentTarget)}
            >
              Status
            </MuiButton>
            {/* The primary page action: the same filled dark green as Add Player (the shared primary button) */}
            <MuiButton
              component={RouterLink}
              to={`/manage/players/${player.id}/edit`}
              variant="contained"
              startIcon={<EditOutlinedIcon fontSize="small" />}
            >
              Edit
            </MuiButton>
          </Box>
        </Box>
      </PageHeaderBand>

      {/* docs/specs/088: an unverified or rejected player shows a banner above the cards, with the same Status menu. */}
      {(status === 'unverified' || status === 'rejected') && (
        <Box
          role="status"
          data-testid="player-status-banner"
          data-tone={status === 'unverified' ? 'warning' : 'closed'}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1.25,
            borderRadius: 1,
            border: 1,
            bgcolor: (theme) => alpha(status === 'unverified' ? theme.palette.warning.main : theme.palette.error.main, 0.14),
            borderColor: (theme) => alpha(status === 'unverified' ? theme.palette.warning.main : theme.palette.error.main, 0.5),
            color: status === 'unverified' ? 'warning.dark' : 'error.dark',
          }}
        >
          <ErrorOutlineIcon fontSize="small" />
          <Typography variant="body2" fontWeight={600} sx={{ flex: '1 1 220px' }}>
            {status === 'unverified'
              ? 'This player request is waiting for you. Change the status to verify or reject it.'
              : 'This player request was rejected, so they are hidden from the player list. You can verify them again.'}
          </Typography>
          <MuiButton variant="contained" onClick={(event) => setStatusAnchor(event.currentTarget)}>
            Change status
          </MuiButton>
        </Box>
      )}

      <PlayerKeyFigures player={player} />

      <Box sx={{ display: 'grid', gap: { xs: 1.75, md: 2 }, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
        <InfoCard
          title="Basic info"
          icon={<InfoOutlinedIcon />}
          fields={[
            { label: 'Date of birth', value: dateOfBirthText },
            { label: 'Gender', value: player.gender ? GENDER_LABEL[player.gender] : null },
            { label: 'Club membership number', value: player.clubMembershipNumber },
            { label: 'Jersey number', value: player.jerseyNumber != null ? `#${player.jerseyNumber}` : null },
          ]}
        />

        <InfoCard
          title="Contact info"
          icon={<AlternateEmailIcon />}
          fields={[
            { label: 'Phone', value: player.phone },
            { label: 'Email', value: player.email },
            { label: 'Alternative contact name', value: player.altContactName },
            { label: 'Alternative contact phone', value: player.altContactPhone },
            { label: 'Medical aid provider', value: player.medicalAidProvider },
            { label: 'Medical aid number', value: player.medicalAidMemberNumber },
          ]}
          actions={
            (player.phone || player.email) && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: player.phone && player.email ? '1fr 1fr' : '1fr', md: 'none' }, gridAutoFlow: { md: 'column' }, justifyContent: { md: 'start' }, gap: 1 }}>
                {player.phone && (
                  <MuiButton component="a" href={`tel:${player.phone}`} variant="outlined" startIcon={<PhoneOutlinedIcon fontSize="small" />} sx={{ minHeight: { xs: 44, md: 34 } }}>
                    Call
                  </MuiButton>
                )}
                {player.email && (
                  <MuiButton component="a" href={`mailto:${player.email}`} variant="outlined" startIcon={<EmailOutlinedIcon fontSize="small" />} sx={{ minHeight: { xs: 44, md: 34 } }}>
                    Email
                  </MuiButton>
                )}
              </Box>
            )
          }
        />

        <InfoCard title="Cricket info" icon={<SportsCricketOutlinedIcon />} chips={cricketChips} />

        {/* Games are real (the platform's own selections); runs and wickets have no data source yet, so they stay "–"
            and are never invented (docs/specs/060 non-goals). */}
        <InfoCard
          title="Stats"
          icon={<EqualizerOutlinedIcon />}
          note="More coming soon"
          fields={[
            { label: 'Games this season', value: String(player.gamesThisSeason) },
            { label: 'Games overall', value: String(player.gamesOverall) },
            { label: 'Runs', value: null },
            { label: 'Wickets', value: null },
          ]}
        />
      </Box>

      <PlayerStatusMenu
        status={status}
        anchorEl={statusAnchor}
        onClose={() => setStatusAnchor(null)}
        onAction={(action) => statusActions.requestAction(player, action)}
      />
      {statusActions.dialog}
    </Box>
  )
}
