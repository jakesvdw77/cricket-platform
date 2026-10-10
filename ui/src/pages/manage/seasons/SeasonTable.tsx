import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import { badgeSx } from '../../../components/RecordCard'
import type { Season, SeasonSummary } from '../../../api/seasonApi'
import { formatSeasonRange, localToday, seasonBadge } from '../../../utils/seasonStatus'
import { zebraTint } from '../../../utils/zebraTint'

export interface SeasonTableProps {
  seasons: Season[]
  // The figures by season id; absent (loading, or the summary failed) shows a dash.
  summaries: Record<string, SeasonSummary> | null
  // Today as a local YYYY-MM-DD string; injectable for tests and stories.
  today?: string
}

const NOT_ON_FILE = '-'

// Desktop: Season, Dates, Status, Leagues, Teams, Matches, chevron. A phone keeps Season (with its status badge under the
// name), Dates and the chevron.
const COLUMNS = {
  xs: 'minmax(0, 1fr) minmax(0, 1fr) 24px',
  sm: 'minmax(180px, 1.4fr) minmax(230px, 1.6fr) 100px 80px 80px 80px 32px',
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

function SeasonRow({ season, summary, today }: { season: Season; summary: SeasonSummary | null; today: string }) {
  const badge = seasonBadge(season, today)
  const figure = (value: number | undefined) => (value === undefined ? NOT_ON_FILE : value)

  return (
    <Box
      role="row"
      data-testid="season-row"
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
        <Avatar
          variant="rounded"
          sx={{ width: 36, height: 36, flex: 'none', bgcolor: 'background.paper', color: 'primary.main', border: 1, borderColor: 'divider', borderRadius: 1.25, display: { xs: 'none', sm: 'flex' } }}
        >
          <CalendarMonthOutlinedIcon fontSize="small" />
        </Avatar>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'flex-start' }}>
          <Typography variant="body2" fontWeight={600} noWrap component="div" sx={{ maxWidth: '100%' }}>
            {/* Stretched link over the whole row (docs/specs/059): the row is position: relative. */}
            <MuiLink component={RouterLink} to={`/manage/fixtures/seasons/${season.id}`} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
              {season.label}
            </MuiLink>
          </Typography>
          <Chip
            size="small"
            label={badge.label}
            data-testid="season-row-phone-status"
            sx={{ ...badgeSx(badge.tone), display: { xs: 'inline-flex', sm: 'none' }, height: 20, fontSize: '0.6875rem' }}
          />
        </Box>
      </Box>
      <Typography role="cell" variant="body2" color="text.secondary" data-testid="season-row-dates" sx={{ minWidth: 0, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
        {formatSeasonRange(season)}
      </Typography>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="season-row-status">
        <Chip size="small" label={badge.label} sx={{ ...badgeSx(badge.tone), height: 22, fontSize: '0.75rem' }} />
      </Box>
      <Typography role="cell" variant="body2" fontWeight={600} sx={{ ...desktopOnly, fontVariantNumeric: 'tabular-nums' }} {...DESKTOP_ONLY} data-testid="season-row-leagues">
        {figure(summary?.leagueCount)}
      </Typography>
      <Typography role="cell" variant="body2" fontWeight={600} sx={{ ...desktopOnly, fontVariantNumeric: 'tabular-nums' }} {...DESKTOP_ONLY} data-testid="season-row-teams">
        {figure(summary?.teamsEntered)}
      </Typography>
      <Typography role="cell" variant="body2" fontWeight={600} sx={{ ...desktopOnly, fontVariantNumeric: 'tabular-nums' }} {...DESKTOP_ONLY} data-testid="season-row-matches">
        {figure(summary?.matchCount)}
      </Typography>
      <Box role="cell" aria-hidden sx={{ display: 'flex', justifyContent: 'center', color: 'primary.main' }}>
        <ChevronRightOutlinedIcon fontSize="small" />
      </Box>
    </Box>
  )
}

// docs/specs/094-club-structure-and-seasons.md (B): the list view of the Seasons page, built like LeagueTable, PlayerTable
// and MatchTable: one bordered panel with a header row that sticks to the top of the scrolling page and zebra rows; the
// whole row opens the season. A phone keeps Season (status badge under the name), Dates and the chevron.
export function SeasonTable({ seasons, summaries, today = localToday() }: SeasonTableProps) {
  return (
    <Box
      role="table"
      aria-label="Seasons"
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
        <Box role="columnheader">Season</Box>
        <Box role="columnheader">Dates</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Leagues</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Teams</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Matches</Box>
        <Box role="columnheader" aria-label="Open" />
      </Box>
      <Box role="rowgroup">
        {seasons.map((season) => (
          <SeasonRow key={season.id} season={season} summary={summaries?.[season.id] ?? null} today={today} />
        ))}
      </Box>
    </Box>
  )
}
