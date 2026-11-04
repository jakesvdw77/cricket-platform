import { useMemo, useState } from 'react'
import { LogoAvatar } from '../../components/LogoAvatar'
import { useOutletContext, useParams } from 'react-router-dom'
import { useBackLink } from '../../hooks/useReturnTo'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import { Button } from '../../components/Button'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { PlayerActionsMenu } from '../../components/PlayerActionsMenu'
import { badgeSx } from '../../components/RecordCard'
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
import { PlayerStatsCard } from './playerDetail/PlayerStatsCard'
import { PlayerAccountSection } from './playerDetail/PlayerAccountSection'
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
  const backLink = useBackLink('/manage/players', 'Back to Players')
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
      <ManageScreenHeader
        title={fullName(player)}
        backTo={backLink.to ?? '/manage/players'}
        backLabel={backLink.label}
        // docs/specs/141: the avatar and the ONE status badge sit beside the name, as a result's logos and badge do.
        titleAdornment={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <LogoAvatar
              src={playerAvatarSrc(player.photoUrl, player.gender)}
              variant="circular"
              size={40}
              kind="person"
              keepTile={!player.photoUrl}
              fontSize="0.9rem"
            >
              {initialsFromName(fullName(player))}
            </LogoAvatar>
            <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="player-status-badge" />
          </Box>
        }
        // The player's tagged sections under the title (docs/specs/060).
        subtitle={
          taggedSections.length > 0 ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
              {taggedSections.map((section) => (
                <Chip key={section.id} size="small" variant="outlined" label={sectionPath(section)} />
              ))}
            </Stack>
          ) : undefined
        }
        action={<PlayerActionsMenu player={player} trigger="button" onStatusAction={(action) => statusActions.requestAction(player, action)} />}
      />

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
          <Button size="compact" onClick={(event) => setStatusAnchor(event.currentTarget)}>
            Change Status
          </Button>
        </Box>
      )}

      <PlayerKeyFigures player={player} />

      {/* docs/specs/141 (owner, 2026-11-04): no wasted width on a big screen. md: two columns (Basic and Contact, then Cricket and Account full width). lg and up: three columns, so
          everything is on screen without scrolling: Basic Info over Account, Contact Info, and the Cricket card. */}
      <Box sx={{ display: 'grid', gap: { xs: 1.75, md: 2 }, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
        <Box sx={{ gridColumn: { lg: 1 }, gridRow: { lg: 1 }, '& > *': { height: '100%' } }}>
        <InfoCard
          flat
          title="Basic Info"
          icon={<InfoOutlinedIcon />}
          fields={[
            { label: 'Date of birth', value: dateOfBirthText },
            { label: 'Gender', value: player.gender ? GENDER_LABEL[player.gender] : null },
            { label: 'Club membership number', value: player.clubMembershipNumber },
            { label: 'Jersey number', value: player.jerseyNumber != null ? `#${player.jerseyNumber}` : null },
          ]}
        />
        </Box>

        <Box sx={{ gridColumn: { lg: 2 }, gridRow: { lg: '1 / span 2' }, '& > *': { height: '100%' } }}>
        <InfoCard
          flat
          title="Contact Info"
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
                  <Button component="a" href={`tel:${player.phone}`} size="compact" variant="secondary" startIcon={<PhoneOutlinedIcon fontSize="small" />}>
                    Call
                  </Button>
                )}
                {player.email && (
                  <Button component="a" href={`mailto:${player.email}`} size="compact" variant="secondary" startIcon={<EmailOutlinedIcon fontSize="small" />}>
                    Email
                  </Button>
                )}
              </Box>
            )
          }
        />
        </Box>

        {/* docs/specs/103 decision 24: one Cricket card (chips, career figures, form), full width on a tablet, the third column from lg. */}
        <Box sx={{ gridColumn: { md: '1 / -1', lg: 3 }, gridRow: { lg: '1 / span 2' }, '& > *': { height: '100%' } }}>
          <PlayerStatsCard clubId={clubId} playerId={player.id} chips={cricketChips} />
        </Box>

        {/* docs/specs/119 shortcut (b): read-only Account card (main agent and other agents). */}
        <Box sx={{ gridColumn: { md: '1 / -1', lg: 1 }, gridRow: { lg: 2 }, '& > *': { height: '100%' } }}>
          <PlayerAccountSection clubId={clubId} playerId={player.id} playerName={`${player.firstName} ${player.lastName}`} />
        </Box>
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
