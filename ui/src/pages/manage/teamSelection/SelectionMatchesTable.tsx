import { Box, Button as MuiButton, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import { Button } from '../../../components/Button'
import { badgeSx } from '../../../components/RecordCard'
import { SelectionGauge } from '../../../components/SelectionGauge'
import type { TeamSelectionMatch, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { zebraTint } from '../../../utils/zebraTint'
import { selectTeamPath } from './selectionLinks'
import { STATUS_LABELS, STATUS_TONES } from './selectionStatus'

export interface SelectionMatchesTableProps {
  matches: TeamSelectionMatch[]
  // Announces a side (the Announce button of a side that is ready); absent, the button is not offered.
  onAnnounce?: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  // The side being announced right now (its button is disabled).
  announcingSideId?: string | null
}

// docs/specs/093-team-selection-hub.md: the zebra table of the Matches view - one row per club side (a derby has
// two). Desktop: When, Match, Team, Selection, Status, action, chevron. A phone keeps Match (the time under it), Picked and
// the chevron, like the Matches list.
// Compact row action: the theme's small button is too tall for a dense table row.
const rowActionSx = { whiteSpace: 'nowrap', minHeight: 28, py: 0.25, px: 1.5, fontSize: '0.75rem', lineHeight: 1.5 } as const

const COLUMNS = {
  xs: 'minmax(0, 1fr) 54px 32px',
  sm: '150px minmax(200px, 2fr) minmax(110px, 1fr) 170px 150px 150px 32px',
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  columnGap: { xs: 0.75, sm: 1.5 },
  px: 1.5,
} as const

const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
const phoneOnly = { display: { xs: 'block', sm: 'none' } } as const
// Marks those cells for assistive tooling and tests (jsdom does not evaluate responsive CSS).
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function SideRow({
  match,
  side,
  onAnnounce,
  announcing,
}: {
  match: TeamSelectionMatch
  side: TeamSelectionSide
  onAnnounce?: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  announcing: boolean
}) {
  const to = selectTeamPath(match.matchId, side.sideId, side.home)
  const title = side.home ? `${side.teamName} v ${side.opponentName}` : `${side.opponentName} v ${side.teamName}`
  const when = formatMatchDateTime(match.matchDate)
  const max = side.limits.maxSelected
  const canAnnounce = side.status === 'READY_TO_ANNOUNCE' && side.sideId !== null && Boolean(onAnnounce)
  return (
    <Box
      role="row"
      data-testid="selection-row"
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 60, sm: 64 },
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
        '&:hover': { bgcolor: hoverTint },
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap component="div">
          {/* Stretched link over the whole row; the buttons sit above it. */}
          <MuiLink component={RouterLink} to={to} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
            {title}
          </MuiLink>
        </Typography>
        {match.leagueName && (
          <Typography variant="caption" color="text.secondary" noWrap component="div" sx={desktopOnly} {...DESKTOP_ONLY}>
            {match.leagueName}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" noWrap component="div" sx={phoneOnly} data-testid="selection-row-phone-when">
          {when}
        </Typography>
      </Box>
      <Box role="cell" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY} data-testid="selection-row-when">
        <Typography variant="body2" fontWeight={600} component="div" noWrap>
          {when}
        </Typography>
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="selection-row-team">
        <Typography variant="body2" noWrap component="div">
          {side.teamName}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {side.home ? 'Home' : 'Away'}
        </Typography>
      </Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-end', sm: 'flex-start' }, minWidth: 0 }} data-testid="selection-row-selection">
        <Typography variant="caption" color="text.secondary" sx={{ ...phoneOnly, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {`${side.pickedCount}/${max}`}
        </Typography>
        <Box sx={{ ...desktopOnly, width: '100%' }} {...DESKTOP_ONLY}>
          <SelectionGauge
            picked={side.pickedCount}
            size={max}
            ariaLabel={`${side.teamName} selection, ${side.pickedCount} of ${max} picked`}
            testIdPrefix={`selection-${match.matchId}-${side.teamId}`}
          />
        </Box>
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="selection-row-status">
        <Chip
          size="small"
          label={STATUS_LABELS[side.status]}
          variant={STATUS_TONES[side.status] === 'neutral' ? 'outlined' : 'filled'}
          sx={{ ...badgeSx(STATUS_TONES[side.status]), height: 22, fontSize: '0.75rem' }}
        />
      </Box>
      <Box role="cell" sx={{ ...desktopOnly, position: 'relative', zIndex: 1 }} {...DESKTOP_ONLY} data-testid="selection-row-action">
        {canAnnounce ? (
          <Button size="sm" onClick={() => onAnnounce?.(match, side)} disabled={announcing} sx={rowActionSx}>
            {announcing ? 'Announcing…' : 'Announce'}
          </Button>
        ) : (
          <MuiButton
            size="small"
            variant={side.status === 'ANNOUNCED' ? 'outlined' : 'contained'}
            component={RouterLink}
            to={to}
            sx={rowActionSx}
          >
            Select players
          </MuiButton>
        )}
      </Box>
      <Box role="cell" aria-hidden sx={{ display: 'flex', justifyContent: 'center', color: 'primary.main' }}>
        <ChevronRightOutlinedIcon fontSize="small" />
      </Box>
    </Box>
  )
}

export function SelectionMatchesTable({ matches, onAnnounce, announcingSideId = null }: SelectionMatchesTableProps) {
  return (
    <Box
      role="table"
      aria-label="Team selection by match"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        boxShadow: 2,
        // clip, not hidden: rounds the corners without becoming a scroll container, so the sticky header still sticks
        overflow: 'clip',
      }}
    >
      <Box
        role="row"
        sx={{
          ...gridSx,
          position: 'sticky',
          top: 0,
          zIndex: 2,
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
        <Box role="columnheader" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY}>When</Box>
        <Box role="columnheader">Match</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Team</Box>
        <Box role="columnheader" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>
          <Box component="span" sx={phoneOnly}>Picked</Box>
          <Box component="span" sx={desktopOnly} {...DESKTOP_ONLY}>Selection</Box>
        </Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY} aria-label="Action" />
        <Box role="columnheader" aria-label="Open" />
      </Box>
      <Box role="rowgroup">
        {matches.flatMap((match) =>
          match.sides.map((side) => (
            <SideRow
              key={`${match.matchId}:${side.teamId}`}
              match={match}
              side={side}
              onAnnounce={onAnnounce}
              announcing={side.sideId !== null && side.sideId === announcingSideId}
            />
          )),
        )}
      </Box>
    </Box>
  )
}
