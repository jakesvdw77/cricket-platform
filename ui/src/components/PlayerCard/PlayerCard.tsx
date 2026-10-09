import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import {
  Avatar,
  Box,
  ButtonBase,
  Card as MuiCard,
  CardActions,
  CardContent,
  Chip,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import SportsBaseballOutlinedIcon from '@mui/icons-material/SportsBaseballOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import TagOutlinedIcon from '@mui/icons-material/TagOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { avatarSx, badgeSx } from '../RecordCard'
import { DetailLine } from '../DetailLine'
import { PlayerStatusMenu } from '../PlayerStatusMenu'
import { playerAvatarSrc } from '../BrandIcon'
import { initialsFromName } from '../../utils/initials'
import { BATTING_STANCE_LABEL, BOWLING_ARM_LABEL, BOWLING_TYPE_LABEL } from '../../utils/playerLabels'
import { formatDateOfBirth, NOT_ON_FILE } from '../../utils/playerFormat'
import { playerStatusBadge, playerStatusOf } from '../../utils/playerStatus'
import type { PlayerStatusAction } from '../../utils/playerStatus'
import { zebraTint } from '../../utils/zebraTint'
import type { Player } from '../../api/playerApi'

export interface PlayerCardProps {
  player: Player
  // Already resolved client-side by the caller (PlayerList's own sectionNamesFor join) - this component only renders the
  // first name plus a `+N` overflow chip, it never resolves ids itself.
  sectionNames: string[]
  viewTo: string
  editTo: string
  // docs/specs/088: called when the manager picks a change in the Status menu; the caller does the work and the
  // confirmations (usePlayerStatusActions).
  onStatusAction: (action: PlayerStatusAction) => void
}

function bowlingText(player: Player): string {
  const parts = [
    player.bowlingArm ? BOWLING_ARM_LABEL[player.bowlingArm] : null,
    player.bowlingType ? BOWLING_TYPE_LABEL[player.bowlingType] : null,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(', ') : NOT_ON_FILE
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Box
      data-testid="player-detail-row"
      sx={{ p: 1, borderRadius: 0.75, '&:nth-of-type(odd)': { bgcolor: zebraTint } }}
    >
      <DetailLine icon={icon} label={label} value={value} muted={value === NOT_ON_FILE} />
    </Box>
  )
}

const footerButtonSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.25,
  minWidth: 0,
  width: '100%',
  py: 1,
  px: 0.25,
  borderRadius: 1,
  color: 'primary.dark',
  '&:hover': { bgcolor: 'action.hover' },
  '&.Mui-focusVisible': { bgcolor: 'action.focus' },
} as const

const footerCaptionSx = { fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' } as const

// docs/specs/088-players-polls-alignment.md: the Player card on the poll card's layout, with one rule on top - every card
// has the same parts and the same height whatever is on file or what the player's status is: the avatar and a title
// clamped to two lines; one badge row (the status first, then the first section and a +N, or a dashed "No section");
// two games-played chips in the header's corner; five zebra rows (Number, Born, Phone, Bat, Bowl) that show "–" when
// empty; and the same three footer columns, Status,
// Edit and View. Nothing appears or disappears with the status; the Status button's menu offers only the valid changes.
export function PlayerCard({ player, sectionNames, viewTo, editTo, onStatusAction }: PlayerCardProps) {
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null)
  const name = `${player.firstName} ${player.lastName}`
  const status = playerStatusOf(player)
  const badge = playerStatusBadge(status)

  return (
    // height: '100%' + column flex, position: relative + hover halo - the same fixes RecordCard applies, so a row of
    // these cards sits at one height with the footer pinned, and the whole card (the title's stretched link) is clickable.
    <MuiCard
      sx={{
        bgcolor: 'background.paper',
        boxShadow: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
        outline: '1px solid transparent',
        '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: '1 1 auto' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
          <Avatar src={playerAvatarSrc(player.photoUrl, player.gender)} variant="circular" sx={avatarSx(56)}>
            {initialsFromName(name)}
          </Avatar>
          <Typography
            variant="subtitle1"
            component="h3"
            fontWeight={600}
            sx={{
              flex: 1,
              minWidth: 0,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {/* Stretched-link title (docs/specs/059): the link stays position: static so its ::after resolves its
                containing block to the card above. */}
            <MuiLink
              component={RouterLink}
              to={viewTo}
              color="inherit"
              underline="none"
              sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}
            >
              {name}
            </MuiLink>
          </Typography>
          {/* docs/specs/088: games played, top-right of the header. Always present ("0" when none) so the card never
              changes height; the column stretches its two chips to one width, and the minimum width keeps them
              lining up from card to card. Plain text, not buttons. */}
          <Stack
            data-testid="player-games-chips"
            spacing={0.5}
            sx={{ flex: 'none', minWidth: 104, alignItems: 'stretch', position: 'relative' }}
          >
            <Chip
              size="small"
              variant="outlined"
              aria-label={`${player.gamesThisSeason} games this season`}
              label={
                <>
                  <b>{player.gamesThisSeason}</b> this season
                </>
              }
              sx={{ height: 22, fontSize: '0.75rem', '& .MuiChip-label': { px: 1 } }}
            />
            <Chip
              size="small"
              variant="outlined"
              aria-label={`${player.gamesOverall} games overall`}
              label={
                <>
                  <b>{player.gamesOverall}</b> overall
                </>
              }
              sx={{ height: 22, fontSize: '0.75rem', '& .MuiChip-label': { px: 1 } }}
            />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minHeight: 24 }}>
          <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="player-status-badge" />
          {sectionNames.length > 0 ? (
            <Chip size="small" variant="outlined" label={sectionNames[0]} />
          ) : (
            <Chip
              size="small"
              variant="outlined"
              label="No section"
              sx={{ color: 'text.secondary', borderStyle: 'dashed', borderColor: 'text.disabled' }}
            />
          )}
          {sectionNames.length > 1 && <Chip size="small" variant="outlined" label={`+${sectionNames.length - 1}`} />}
        </Stack>

        {/* The same five rows on every card; the margin lets the zebra tint bleed to the card padding's edge. */}
        <Stack sx={{ mx: -1 }}>
          <DetailRow
            icon={<TagOutlinedIcon fontSize="small" />}
            label="Number"
            value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : NOT_ON_FILE}
          />
          <DetailRow
            icon={<CalendarTodayOutlinedIcon fontSize="small" />}
            label="Born"
            value={formatDateOfBirth(player.dateOfBirth)}
          />
          <DetailRow icon={<PhoneOutlinedIcon fontSize="small" />} label="Phone" value={player.phone || NOT_ON_FILE} />
          <DetailRow
            icon={<SportsCricketOutlinedIcon fontSize="small" />}
            label="Bat"
            value={player.battingStance ? BATTING_STANCE_LABEL[player.battingStance] : NOT_ON_FILE}
          />
          <DetailRow icon={<SportsBaseballOutlinedIcon fontSize="small" />} label="Bowl" value={bowlingText(player)} />
        </Stack>
      </CardContent>

      {/* position: relative lifts the buttons above the title's stretched-link overlay (docs/specs/059). */}
      <CardActions
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 0.5,
          px: 1,
          pb: 1,
          pt: 0,
          position: 'relative',
          borderTop: 1,
          borderColor: 'divider',
          '& > :not(:first-of-type)': { ml: 0 },
        }}
      >
        <ButtonBase
          aria-haspopup="menu"
          aria-label="Change status"
          title="Change status"
          onClick={(event: MouseEvent<HTMLElement>) => setStatusAnchor(event.currentTarget)}
          sx={footerButtonSx}
        >
          <ManageAccountsOutlinedIcon fontSize="small" />
          <Box component="span" sx={footerCaptionSx}>
            Status
          </Box>
        </ButtonBase>
        <ButtonBase component={RouterLink} to={editTo} aria-label="Edit" sx={footerButtonSx}>
          <EditOutlinedIcon fontSize="small" />
          <Box component="span" sx={footerCaptionSx}>
            Edit
          </Box>
        </ButtonBase>
        <ButtonBase component={RouterLink} to={viewTo} aria-label="View" sx={footerButtonSx}>
          <VisibilityOutlinedIcon fontSize="small" />
          <Box component="span" sx={footerCaptionSx}>
            View
          </Box>
        </ButtonBase>
      </CardActions>

      <PlayerStatusMenu
        status={status}
        anchorEl={statusAnchor}
        onClose={() => setStatusAnchor(null)}
        onAction={onStatusAction}
      />
    </MuiCard>
  )
}
