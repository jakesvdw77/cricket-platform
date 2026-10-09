import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Box, Chip, IconButton, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import { avatarSx, badgeSx } from '../RecordCard'
import { PlayerStatusMenu } from '../PlayerStatusMenu'
import { playerAvatarSrc } from '../BrandIcon'
import { initialsFromName } from '../../utils/initials'
import { BATTING_STANCE_LABEL, BOWLING_ARM_LABEL, BOWLING_TYPE_LABEL } from '../../utils/playerLabels'
import { playerStatusBadge, playerStatusOf } from '../../utils/playerStatus'
import type { PlayerStatusAction } from '../../utils/playerStatus'
import { zebraTint } from '../../utils/zebraTint'
import type { Player } from '../../api/playerApi'

export interface PlayerTableProps {
  players: Player[]
  // Already resolved client-side by the caller (PlayerList's own join) - this component only shows the first name and a +N.
  sectionNamesFor: (player: Player) => string[]
  viewTo: (player: Player) => string
  // The Status button's menu: the caller does the work and the confirmations (usePlayerStatusActions).
  onStatusAction: (player: Player, action: PlayerStatusAction) => void
}

const NOT_ON_FILE = '–'

// Desktop: Player, Status, Section, No., Phone, Bat, Bowl, This season, Overall, Status button. A phone keeps Player (the
// status badge moves under the name), the two games columns and the button.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 54px 54px 44px',
  sm: 'minmax(200px, 2.2fr) 110px minmax(110px, 1.2fr) 52px 130px 110px 150px 80px 80px 44px',
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  columnGap: { xs: 0.75, sm: 1.5 },
  px: { xs: 1.5, sm: 1.5 },
} as const

// The columns a phone drops.
const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function bowlingText(player: Player): string {
  const parts = [
    player.bowlingArm ? BOWLING_ARM_LABEL[player.bowlingArm] : null,
    player.bowlingType ? BOWLING_TYPE_LABEL[player.bowlingType] : null,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(', ') : NOT_ON_FILE
}

function Cell({ children, value, sx }: { children?: ReactNode; value?: string; sx?: object }) {
  const missing = value === NOT_ON_FILE
  return (
    <Typography
      component="div"
      role="cell"
      variant="body2"
      sx={{ minWidth: 0, color: missing ? 'text.secondary' : 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...sx }}
    >
      {children ?? value}
    </Typography>
  )
}

function PlayerRow({
  player,
  sections,
  viewTo,
  onStatusAction,
}: {
  player: Player
  sections: string[]
  viewTo: string
  onStatusAction: (action: PlayerStatusAction) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const name = `${player.firstName} ${player.lastName}`
  const status = playerStatusOf(player)
  const badge = playerStatusBadge(status)

  return (
    <Box
      role="row"
      data-testid="player-row"
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 56, sm: 44 },
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
        '&:hover': { bgcolor: hoverTint },
        // a keyboard user tabbing to the name (or the Status button) sees the whole row marked
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar
          src={playerAvatarSrc(player.photoUrl, player.gender)}
          variant="circular"
          sx={{ ...avatarSx(32, '0.75rem'), width: { xs: 40, sm: 32 }, height: { xs: 40, sm: 32 } }}
        >
          {initialsFromName(name)}
        </Avatar>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant="body2" fontWeight={600} noWrap component="div">
            {/* Stretched link over the whole row (docs/specs/059): the row is position: relative, so a click anywhere
                on it opens the player; the Status button below sits above it and never navigates. */}
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
          {/* On a phone the status badge sits under the name (the Status column is dropped) */}
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            <Chip size="small" label={badge.label} sx={{ ...badgeSx(badge.tone), height: 20, fontSize: '0.6875rem' }} data-testid="player-status-badge" />
          </Box>
        </Box>
      </Box>
      <Box role="cell" sx={desktopOnly}>
        <Chip size="small" label={badge.label} sx={{ ...badgeSx(badge.tone), height: 22, fontSize: '0.75rem' }} data-testid="player-status-badge-desktop" />
      </Box>
      <Cell
        value={sections.length > 0 ? sections[0] : 'No section'}
        sx={{ ...desktopOnly, color: sections.length > 0 ? 'text.primary' : 'text.secondary' }}
      >
        {sections.length > 0 ? `${sections[0]}${sections.length > 1 ? ` +${sections.length - 1}` : ''}` : 'No section'}
      </Cell>
      <Cell value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : NOT_ON_FILE} sx={desktopOnly} />
      <Cell value={player.phone || NOT_ON_FILE} sx={desktopOnly} />
      <Cell value={player.battingStance ? BATTING_STANCE_LABEL[player.battingStance] : NOT_ON_FILE} sx={desktopOnly} />
      <Cell value={bowlingText(player)} sx={desktopOnly} />
      <Cell sx={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{player.gamesThisSeason}</Cell>
      <Cell sx={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{player.gamesOverall}</Cell>
      <Box role="cell" sx={{ display: 'flex', justifyContent: 'center' }}>
        <IconButton
          aria-label="Change status"
          aria-haspopup="menu"
          title="Change status"
          size="small"
          onClick={(event) => setAnchor(event.currentTarget)}
          // position: relative lifts it above the row's stretched link, so using the menu never navigates
          sx={{ position: 'relative', color: 'primary.dark', width: 36, height: 36 }}
        >
          <ManageAccountsOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>
      <PlayerStatusMenu status={status} anchorEl={anchor} onClose={() => setAnchor(null)} onAction={onStatusAction} />
    </Box>
  )
}

// docs/specs/088-players-polls-alignment.md (F): the list view of the Players page, the standard for the other lists. One
// bordered panel with a header row that sticks to the top of the scrolling page and zebra rows of equal height; the whole
// row opens the player, and each row has the same Status button and menu as the card. A value that is not on file
// shows "-"; a phone keeps only Player, the two games columns and the Status button.
export function PlayerTable({ players, sectionNamesFor, viewTo, onStatusAction }: PlayerTableProps) {
  return (
    <Box
      role="table"
      aria-label="Players"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        boxShadow: 2,
        // clip, not hidden: it rounds the corners without becoming a scroll container, so the sticky header still sticks
        overflow: 'clip',
      }}
    >
      <Box
        role="row"
        sx={{
          ...gridSx,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          height: { xs: 36, sm: 40 },
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          fontSize: { xs: '0.6875rem', sm: '0.75rem' },
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        <Box role="columnheader">Player</Box>
        <Box role="columnheader" sx={desktopOnly}>Status</Box>
        <Box role="columnheader" sx={desktopOnly}>Section</Box>
        <Box role="columnheader" sx={desktopOnly}>No.</Box>
        <Box role="columnheader" sx={desktopOnly}>Phone</Box>
        <Box role="columnheader" sx={desktopOnly}>Bat</Box>
        <Box role="columnheader" sx={desktopOnly}>Bowl</Box>
        <Box role="columnheader" sx={{ textAlign: 'right' }}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>This season</Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Season</Box>
        </Box>
        <Box role="columnheader" sx={{ textAlign: 'right' }}>Overall</Box>
        <Box role="columnheader" aria-label="Status actions" />
      </Box>
      <Box role="rowgroup">
        {players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            sections={sectionNamesFor(player)}
            viewTo={viewTo(player)}
            onStatusAction={(action) => onStatusAction(player, action)}
          />
        ))}
      </Box>
    </Box>
  )
}
