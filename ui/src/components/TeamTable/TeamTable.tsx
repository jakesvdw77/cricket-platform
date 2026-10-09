import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import { avatarSx, badgeSx } from '../RecordCard'
import { initialsFromName } from '../../utils/initials'
import { zebraTint } from '../../utils/zebraTint'
import type { Team } from '../../api/teamApi'

export interface TeamTableRow {
  team: Team
  sectionName: string
  playerCount: number
  matchCount: number
  captainName: string | null
  // False while the squad and matches are still loading: the figures then show "–" rather than a wrong zero.
  loaded: boolean
  // Where the whole row goes.
  to: string
}

export interface TeamTableProps {
  rows: TeamTableRow[]
}

const NOT_ON_FILE = '–'

// Desktop: Team, Section, Players, Matches, Captain, Status, chevron. A phone keeps Team, Players and the chevron.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 64px 32px',
  sm: 'minmax(220px, 2fr) minmax(120px, 1fr) 80px 80px minmax(160px, 1.2fr) 100px 32px',
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  columnGap: { xs: 0.75, sm: 1.5 },
  px: 1.5,
} as const

const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
// Marks those cells for assistive tooling and tests (jsdom does not evaluate responsive CSS).
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

const figureSx = { fontVariantNumeric: 'tabular-nums' } as const

function TeamRow({ row }: { row: TeamTableRow }) {
  const { team, sectionName, loaded } = row
  const figure = (value: number) => (loaded ? value : NOT_ON_FILE)

  return (
    <Box
      role="row"
      data-testid="team-row"
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 60, sm: 56 },
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
        '&:hover': { bgcolor: hoverTint },
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar src={team.logoUrl ?? undefined} variant="rounded" sx={{ ...avatarSx(36, '0.8125rem'), flex: 'none' }}>
          {initialsFromName(team.name)}
        </Avatar>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant="body2" fontWeight={600} noWrap component="div">
            {/* Stretched link over the whole row (docs/specs/059): the row is position: relative. */}
            <MuiLink component={RouterLink} to={row.to} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
              {team.name}
            </MuiLink>
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: 'block', sm: 'none' } }} data-testid="team-row-phone-meta">
            {[sectionName, team.active ? 'Active' : 'Inactive'].join(' · ')}
          </Typography>
        </Box>
      </Box>
      <Typography role="cell" variant="body2" noWrap sx={desktopOnly} {...DESKTOP_ONLY} data-testid="team-row-section">
        {sectionName}
      </Typography>
      <Typography role="cell" variant="body2" fontWeight={600} sx={{ ...figureSx, textAlign: { xs: 'right', sm: 'left' } }} data-testid="team-row-players">
        {figure(row.playerCount)}
      </Typography>
      <Typography role="cell" variant="body2" fontWeight={600} sx={{ ...desktopOnly, ...figureSx }} {...DESKTOP_ONLY} data-testid="team-row-matches">
        {figure(row.matchCount)}
      </Typography>
      <Box role="cell" sx={{ ...desktopOnly, minWidth: 0 }} {...DESKTOP_ONLY} data-testid="team-row-captain">
        {!loaded ? (
          <Typography variant="body2" color="text.secondary">
            {NOT_ON_FILE}
          </Typography>
        ) : row.captainName ? (
          <Typography variant="body2" noWrap>
            {row.captainName}
          </Typography>
        ) : (
          <Typography variant="body2" noWrap sx={{ color: 'warning.dark', fontWeight: 600 }}>
            No captain
          </Typography>
        )}
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="team-row-status">
        <Chip size="small" label={team.active ? 'Active' : 'Inactive'} sx={{ ...badgeSx(team.active ? 'active' : 'muted'), height: 22, fontSize: '0.75rem' }} />
      </Box>
      <Box role="cell" aria-hidden sx={{ display: 'flex', justifyContent: 'center', color: 'primary.main' }}>
        <ChevronRightOutlinedIcon fontSize="small" />
      </Box>
    </Box>
  )
}

// docs/specs/092-teams-gold-standard.md (A): the list view of the Teams page, built like LeagueTable, PlayerTable and
// MatchTable: one bordered panel with a header row that sticks to the top of the scrolling page and zebra rows; the whole
// row opens the team. A phone keeps Team, Players and the chevron.
export function TeamTable({ rows }: TeamTableProps) {
  return (
    <Box
      role="table"
      aria-label="Teams"
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
        <Box role="columnheader">Team</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Section</Box>
        <Box role="columnheader" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>Players</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Matches</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Captain</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" aria-label="Open" />
      </Box>
      <Box role="rowgroup">
        {rows.map((row) => (
          <TeamRow key={row.team.id} row={row} />
        ))}
      </Box>
    </Box>
  )
}
