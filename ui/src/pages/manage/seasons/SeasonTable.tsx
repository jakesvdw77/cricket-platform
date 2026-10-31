import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { SeasonRowMenu } from './SeasonRowMenu'
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
  // docs/specs/129 and page-anatomy section 3: the page's filter bar. Given, the table renders ONE card: this toolbar, a hairline,
  // then the header and rows (no outer border of its own). Omitted, as before.
  toolbar?: ReactNode
  // With a toolbar and no rows: this message replaces the table inside the same card, so the toolbar never remounts.
  empty?: ReactNode
}

const NOT_ON_FILE = '-'

// Desktop: Season, Dates, Status, Leagues, Teams, Matches, actions. A phone keeps Season (with its status badge under the
// name), Dates and the actions button. No chevron: the whole row is the link.
const COLUMNS = {
  xs: 'minmax(0, 1fr) minmax(0, 1fr) 44px',
  sm: 'minmax(180px, 1.4fr) minmax(230px, 1.6fr) 100px 80px 80px 80px 44px',
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

// clip, not hidden: it rounds the corners without becoming a scroll container, so the sticky header still sticks
const cardSx = { border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 0, overflow: 'clip' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function SeasonRow({ season, summary, today }: { season: Season; summary: SeasonSummary | null; today: string }) {
  const badge = seasonBadge(season, today)
  const location = useLocation()
  const to = withReturnTo(`/manage/fixtures/seasons/${season.id}`, currentOrigin(location), 'Seasons')
  const figure = (value: number | undefined) => (value === undefined ? NOT_ON_FILE : value)

  return (
    <Box
      role="row"
      data-testid="season-row"
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 60, sm: 56 },
        '&:nth-of-type(even)': { bgcolor: zebraTint },
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
            <MuiLink component={RouterLink} to={to} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
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
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: 'primary.main' }}>
        <SeasonRowMenu season={season} testId="season-row-actions" />
      </Box>
    </Box>
  )
}

// docs/specs/094-club-structure-and-seasons.md (B): the list view of the Seasons page, built like LeagueTable, PlayerTable
// and MatchTable: one bordered panel with a header row that sticks to the top of the scrolling page and zebra rows; the
// whole row opens the season. A phone keeps Season (status badge under the name), Dates and the kebab.
export function SeasonTable({ seasons, summaries, today = localToday(), toolbar, empty }: SeasonTableProps) {
  const table = (
    <Box
      role="table"
      aria-label="Seasons"
      sx={toolbar ? undefined : cardSx}
    >
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
        <Box role="columnheader" aria-label="Actions" />
      </Box>
      <Box role="rowgroup">
        {seasons.map((season) => (
          <SeasonRow key={season.id} season={season} summary={summaries?.[season.id] ?? null} today={today} />
        ))}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="seasons-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {seasons.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return table
}
