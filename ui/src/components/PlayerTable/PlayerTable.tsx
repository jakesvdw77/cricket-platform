import { LogoAvatar } from '../LogoAvatar'
import type { ReactNode } from 'react'
import { Box, Chip, IconButton, Link as MuiLink, Tooltip, Typography } from '@mui/material'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import { Button } from '../Button'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { badgeSx } from '../RecordCard'
import { ToolbarCard } from '../ToolbarCard'
import { playerAvatarSrc } from '../BrandIcon'
import { initialsFromName } from '../../utils/initials'
import { BATTING_STANCE_LABEL, BOWLING_ARM_LABEL, BOWLING_TYPE_LABEL } from '../../utils/playerLabels'
import { playerStatusBadge, playerStatusOf } from '../../utils/playerStatus'
import { zebraTint } from '../../utils/zebraTint'
import type { Player } from '../../api/playerApi'

export interface PlayerTableProps {
  players: Player[]
  // Already resolved client-side by the caller (PlayerList's own join) - this component only shows the first name and a +N.
  sectionNamesFor: (player: Player) => string[]
  viewTo: (player: Player) => string
  // docs/specs/141: the row's ONE kebab (the caller builds it, see PlayerActionsMenu).
  // docs/specs/141 (owner): View Stats stays a button on the row (an icon on a phone); it is also in the kebab. Already carries returnTo.
  statsTo?: (player: Player) => string
  renderActions?: (player: Player) => ReactNode
  // Given a toolbar the table is ONE card: the toolbar, a hairline, then the header and rows (or `empty`).
  toolbar?: ReactNode
  empty?: ReactNode
}

const NOT_ON_FILE = '–'

// One flat card (hairline, no shadow), as the Results and Matches tables.
const cardSx = { border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 0, overflow: 'clip' } as const

// Desktop: Player, Status, Section, No., Phone, Bat, Bowl, Season, Overall, kebab. A phone keeps Player (the
// status badge moves under the name), Season, Phone and the button, in that order (see `phoneOrder`).
const COLUMNS = {
  xs: 'minmax(0, 1fr) 54px 104px 44px 44px',
  sm: 'minmax(200px, 2.2fr) 110px minmax(110px, 1.2fr) 52px 130px 110px 150px 80px 80px 112px 44px',
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
// Marks those cells for assistive tooling and tests (jsdom does not evaluate responsive CSS).
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

// On a phone the visible cells are Player, Season, Phone, button; in the DOM Phone comes before Season (desktop order), so
// `order` puts Season first on a phone. From `sm` up every cell is back in DOM order.
const phoneOrder = (position: number) => ({ order: { xs: position, sm: 0 } })

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function bowlingText(player: Player): string {
  const parts = [
    player.bowlingArm ? BOWLING_ARM_LABEL[player.bowlingArm] : null,
    player.bowlingType ? BOWLING_TYPE_LABEL[player.bowlingType] : null,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(', ') : NOT_ON_FILE
}

function Cell({ children, value, sx, hiddenOnPhone = false }: { children?: ReactNode; value?: string; sx?: object; hiddenOnPhone?: boolean }) {
  const missing = value === NOT_ON_FILE
  return (
    <Typography
      component="div"
      role="cell"
      variant="body2"
      {...(hiddenOnPhone ? DESKTOP_ONLY : {})}
      sx={{ minWidth: 0, color: missing ? 'text.secondary' : 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(hiddenOnPhone ? desktopOnly : {}), ...sx }}
    >
      {children ?? value}
    </Typography>
  )
}

function PlayerRow({
  player,
  sections,
  viewTo,
  statsTo,
  actions,
}: {
  player: Player
  sections: string[]
  viewTo: string
  statsTo?: string
  actions?: ReactNode
}) {
  const navigate = useNavigate()
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
        <LogoAvatar
          src={playerAvatarSrc(player.photoUrl, player.gender)}
          variant="circular"
          size={32}
          kind="person"
          keepTile={!player.photoUrl}
          fontSize="0.75rem"
          sx={{ width: { xs: 40, sm: 32 }, height: { xs: 40, sm: 32 } }}
        >
          {initialsFromName(name)}
        </LogoAvatar>
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
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY}>
        <Chip size="small" label={badge.label} sx={{ ...badgeSx(badge.tone), height: 22, fontSize: '0.75rem' }} data-testid="player-status-badge-desktop" />
      </Box>
      <Cell
        hiddenOnPhone
        value={sections.length > 0 ? sections[0] : 'No section'}
        sx={{ color: sections.length > 0 ? 'text.primary' : 'text.secondary' }}
      >
        {sections.length > 0 ? `${sections[0]}${sections.length > 1 ? ` +${sections.length - 1}` : ''}` : 'No section'}
      </Cell>
      <Cell hiddenOnPhone value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : NOT_ON_FILE} />
      <Cell value={player.phone || NOT_ON_FILE} sx={{ ...phoneOrder(2), fontSize: { xs: '0.8125rem', sm: '0.875rem' } }} />
      <Cell hiddenOnPhone value={player.battingStance ? BATTING_STANCE_LABEL[player.battingStance] : NOT_ON_FILE} />
      <Cell hiddenOnPhone value={bowlingText(player)} />
      <Cell sx={{ ...phoneOrder(1), textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{player.gamesThisSeason}</Cell>
      {/* Overall is a desktop column; a phone shows the phone number instead */}
      <Cell hiddenOnPhone sx={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{player.gamesOverall}</Cell>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, ...phoneOrder(3) }}>
        {statsTo && (
          <>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Button size="compact" variant="ghost" startIcon={<EqualizerOutlinedIcon />} onClick={() => navigate(statsTo)} data-testid="player-row-stats" sx={{ color: 'primary.dark' }}>
                View Stats
              </Button>
            </Box>
            <Tooltip title="View Stats">
              <IconButton aria-label={`View stats for ${name}`} size="small" onClick={() => navigate(statsTo)} sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: 'primary.dark', width: 44, height: 44 }}>
                <EqualizerOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, ...phoneOrder(4) }}>
        {actions}
      </Box>
    </Box>
  )
}

// docs/specs/088-players-polls-alignment.md (F): the list view of the Players page, the standard for the other lists. One
// bordered panel with a header row that sticks to the top of the scrolling page and zebra rows of equal height; the whole
// row opens the player, and each row has the same Status button and menu as the card. A value that is not on file
// shows "-"; a phone keeps only Player, Season, Phone and the Status button.
export function PlayerTable({ players, sectionNamesFor, viewTo, statsTo, renderActions, toolbar, empty }: PlayerTableProps) {
  const table = (
    <Box role="table" aria-label="Players" sx={toolbar ? undefined : cardSx}>
      <Box
        role="row"
        sx={{
          ...gridSx,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          height: { xs: 36, sm: 40 },
          bgcolor: zebraTint,
          borderBottom: 1,
          borderColor: 'divider',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        <Box role="columnheader">Player</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Section</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>No.</Box>
        <Box role="columnheader" sx={phoneOrder(2)}>Phone</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Bat</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Bowl</Box>
        <Box role="columnheader" sx={{ ...phoneOrder(1), textAlign: 'right' }}>Season</Box>
        <Box role="columnheader" sx={{ ...desktopOnly, textAlign: 'right' }} {...DESKTOP_ONLY}>Overall</Box>
        <Box role="columnheader" aria-label="Stats" sx={phoneOrder(3)} />
        <Box role="columnheader" aria-label="Actions" sx={phoneOrder(4)} />
      </Box>
      <Box role="rowgroup">
        {players.map((player) => (
          <PlayerRow key={player.id} player={player} sections={sectionNamesFor(player)} viewTo={viewTo(player)} statsTo={statsTo?.(player)} actions={renderActions?.(player)} />
        ))}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="players-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {players.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return table
}
