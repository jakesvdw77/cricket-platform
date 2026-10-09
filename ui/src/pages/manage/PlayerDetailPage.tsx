import { useMemo, useState } from 'react'
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import WcOutlinedIcon from '@mui/icons-material/WcOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import TagOutlinedIcon from '@mui/icons-material/TagOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined'
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import { DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { Card } from '../../components/Card'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { avatarSx, badgeSx } from '../../components/RecordCard'
import { playerAvatarSrc } from '../../components/BrandIcon'
import { PlayerStatusMenu } from '../../components/PlayerStatusMenu'
import { EmptyState } from '../../components/EmptyState'
import { listPlayers, listPlayerSections } from '../../api/playerApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { usePlayerStatusActions } from '../../hooks/usePlayerStatusActions'
import { initialsFromName } from '../../utils/initials'
import { playerStatusBadge, playerStatusOf } from '../../utils/playerStatus'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { GENDER_LABEL, BATTING_STANCE_LABEL, BOWLING_ARM_LABEL, BOWLING_TYPE_LABEL } from '../../utils/playerLabels'
import { fullName } from './PlayerList'

// The uppercase "section label" heading every card on this page uses — copied from
// RecordDetailScreen.tsx's own section-heading markup (docs/specs/060-player-detail-redesign.md)
// so the visual style stays identical even though this page is now bespoke, not built on
// RecordDetailScreen's `sections` prop.
function CardHeading({ children }: { children: string }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1.5 }}
    >
      {children}
    </Typography>
  )
}

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

  const {
    data: player,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'players'],
    queryFn: () => listPlayers(clubId as string),
    enabled: Boolean(clubId),
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

  if (isLoading) {
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

        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} flexWrap="wrap" useFlexGap>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Avatar src={playerAvatarSrc(player.photoUrl, player.gender)} variant="circular" sx={avatarSx(56)}>
              {initialsFromName(fullName(player))}
            </Avatar>
            <Stack spacing={0.75} sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h1" noWrap sx={{ fontWeight: 700 }}>
                {fullName(player)}
              </Typography>
              {/* Section chip row directly under the name — the player's tagged sections relocated
                  here from the old full-width "Sections" card at the bottom of the page, plus the
                  Inactive badge in the same row (docs/specs/060-player-detail-redesign.md). */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {taggedSections.map((section) => (
                  <Chip key={section.id} size="small" variant="outlined" label={sectionPath(section)} />
                ))}
                <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="player-status-badge" />
              </Stack>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flex: 'none' }}>
            <MuiButton
              variant="outlined"
              aria-haspopup="menu"
              startIcon={<ManageAccountsOutlinedIcon fontSize="small" />}
              onClick={(event) => setStatusAnchor(event.currentTarget)}
            >
              Status
            </MuiButton>
            <MuiButton
              component={RouterLink}
              to={`/manage/players/${player.id}/edit`}
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
              Edit
            </MuiButton>
          </Stack>
        </Stack>
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

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Card>
          <CardHeading>Basic Info</CardHeading>
          <DetailFieldGrid>
            <DetailFieldRow icon={<CalendarTodayOutlinedIcon />} label="Date of birth" value={player.dateOfBirth ?? '—'} />
            <DetailFieldRow icon={<WcOutlinedIcon />} label="Gender" value={player.gender ? GENDER_LABEL[player.gender] : '—'} />
            <DetailFieldRow
              icon={<BadgeOutlinedIcon />}
              label="Club membership number"
              value={player.clubMembershipNumber ?? '—'}
            />
            <DetailFieldRow icon={<TagOutlinedIcon />} label="Jersey number" value={player.jerseyNumber ?? '—'} />
          </DetailFieldGrid>
        </Card>

        <Card>
          <CardHeading>Contact Info</CardHeading>
          <DetailFieldGrid>
            <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value={player.phone ?? '—'} />
            <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value={player.email ?? '—'} />
            <DetailFieldRow
              icon={<PersonOutlineOutlinedIcon />}
              label="Alternative contact name"
              value={player.altContactName ?? '—'}
            />
            <DetailFieldRow
              icon={<ContactPhoneOutlinedIcon />}
              label="Alternative contact phone"
              value={player.altContactPhone ?? '—'}
            />
            <DetailFieldRow
              icon={<LocalHospitalOutlinedIcon />}
              label="Medical aid provider"
              value={player.medicalAidProvider ?? '—'}
            />
            <DetailFieldRow
              icon={<LocalHospitalOutlinedIcon />}
              label="Medical aid number"
              value={player.medicalAidMemberNumber ?? '—'}
            />
          </DetailFieldGrid>
        </Card>

        <Card>
          <CardHeading>Cricket Info</CardHeading>
          <DetailFieldGrid>
            <DetailFieldRow
              icon={<SportsCricketOutlinedIcon />}
              label="Batting stance"
              value={player.battingStance ? BATTING_STANCE_LABEL[player.battingStance] : '—'}
            />
            <DetailFieldRow
              icon={<SportsCricketOutlinedIcon />}
              label="Bowling arm"
              value={player.bowlingArm ? BOWLING_ARM_LABEL[player.bowlingArm] : '—'}
            />
            <DetailFieldRow
              icon={<SportsCricketOutlinedIcon />}
              label="Bowling type"
              value={player.bowlingType ? BOWLING_TYPE_LABEL[player.bowlingType] : '—'}
            />
            <DetailFieldRow
              icon={<SportsCricketOutlinedIcon />}
              label="Wicketkeeper"
              value={player.isWicketKeeper ? 'Yes' : 'No'}
            />
          </DetailFieldGrid>
        </Card>

        {/* Placeholder card — no performance-stats data source exists yet anywhere in the schema
            (docs/specs/060-player-detail-redesign.md's Non-goals). Values are always the literal
            em-dash, never fabricated; "Full breakdown" is a visual affordance only, not a link. */}
        <Card>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <CardHeading>Stats</CardHeading>
            <Chip size="small" label="Coming soon" sx={{ ...badgeSx('muted'), mb: 1.5 }} />
          </Stack>
          <DetailFieldGrid>
            <DetailFieldRow icon={<EventOutlinedIcon />} label="Matches" value="—" />
            <DetailFieldRow icon={<SportsCricketOutlinedIcon />} label="Runs" value="—" />
            <DetailFieldRow icon={<SportsCricketOutlinedIcon />} label="Wickets" value="—" />
            <DetailFieldRow icon={<EqualizerOutlinedIcon />} label="Average" value="—" />
          </DetailFieldGrid>
          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" sx={{ mt: 1.5, opacity: 0.6 }}>
            <Typography variant="caption" color="text.secondary">
              Full breakdown
            </Typography>
            <ChevronRightOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Stack>
        </Card>
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
