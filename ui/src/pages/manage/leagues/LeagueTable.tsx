import type { ReactNode } from 'react'
import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { badgeSx } from '../../../components/RecordCard'
import { useCountdown } from '../../../components/Countdown'
import { LEAGUE_FORMAT_LABELS } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { zebraTint } from '../../../utils/zebraTint'
import { formatMatchDateTime } from '../availability/pollHelpers'
import { LeagueRowMenu } from './LeagueRowMenu'

export interface LeagueTableProps {
  leagues: League[]
  // The chosen season, carried into the league page.
  seasonId?: string
  // The row's Actions menu (page-anatomy section 6): the page owns the dialogs. An absent handler leaves its item out.
  onShare?: (league: League) => void
  onDuplicate?: (league: League) => void
  // docs/standards/page-anatomy.md section 3: the page's filter bar. Given, the table renders ONE card: this toolbar row, a hairline, then the
  // header and rows (the table has no outer border of its own). Omitted, as before.
  toolbar?: ReactNode
  // With a toolbar and no rows: this message replaces the table inside the same card, so the toolbar never remounts.
  empty?: ReactNode
}

const NOT_ON_FILE = '–'

// Desktop: League, Format, Teams, Next match, Matches played, Status, actions. A phone keeps League, Played and the actions button.
// No chevron: the whole row is the link (hover tint and pointer are the cue).
const COLUMNS = {
  xs: 'minmax(0, 1fr) 64px 44px',
  sm: 'minmax(220px, 2fr) 90px 70px minmax(170px, 1.2fr) minmax(190px, 1.3fr) minmax(110px, 0.7fr) 44px',
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

function LeagueRow({ league, seasonId, onShare, onDuplicate }: { league: League; seasonId?: string; onShare?: (league: League) => void; onDuplicate?: (league: League) => void }) {
  const next = useCountdown(league.nextMatchDate)
  const soon = next.stage !== 'none' && next.stage !== 'expired' && next.warn
  const matchCount = league.matchCount ?? 0
  const playedCount = league.playedCount ?? 0
  const teamCount = league.teams?.length ?? 0
  const percent = matchCount > 0 ? Math.min(100, (playedCount / matchCount) * 100) : 0
  const countdownText = next.stage === 'none' ? '' : next.stage === 'expired' ? 'Starting now' : `in ${next.text}`
  const location = useLocation()
  const to = withReturnTo(`/manage/fixtures/leagues/${league.id}/schedule${seasonId ? `?seasonId=${seasonId}` : ''}`, currentOrigin(location), 'Leagues')

  return (
    <Box
      role="row"
      data-testid="league-row"
      data-tone={soon ? 'warning' : 'neutral'}
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
          src={league.logoUrl ?? undefined}
          sx={{ width: 36, height: 36, flex: 'none', bgcolor: 'background.paper', color: 'primary.main', border: 1, borderColor: 'divider', borderRadius: 1.25 }}
        >
          <EmojiEventsOutlinedIcon fontSize="small" />
        </Avatar>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant="body2" fontWeight={600} noWrap component="div">
            {/* Stretched link over the whole row (docs/specs/059): the row is position: relative. */}
            <MuiLink component={RouterLink} to={to} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
              {league.name}
            </MuiLink>
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: 'block', sm: 'none' } }} data-testid="league-row-phone-meta">
            {[league.format ? LEAGUE_FORMAT_LABELS[league.format] : null, league.active ? 'Active' : 'Inactive'].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="league-row-format">
        {league.format ? <Chip size="small" variant="outlined" label={LEAGUE_FORMAT_LABELS[league.format]} sx={{ ...badgeSx('format'), height: 22, fontSize: '0.75rem' }} /> : <Typography variant="body2" color="text.secondary">{NOT_ON_FILE}</Typography>}
      </Box>
      <Typography role="cell" variant="body2" fontWeight={600} sx={{ ...desktopOnly, fontVariantNumeric: 'tabular-nums' }} {...DESKTOP_ONLY} data-testid="league-row-teams">
        {teamCount > 0 ? teamCount : NOT_ON_FILE}
      </Typography>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="league-row-next">
        {league.nextMatchDate ? (
          <>
            <Typography variant="body2" fontWeight={600} component="div" noWrap sx={{ color: soon ? 'warning.dark' : 'text.primary' }}>
              {formatMatchDateTime(league.nextMatchDate)}
            </Typography>
            {countdownText && (
              <Typography variant="caption" component="div" sx={{ color: soon ? 'warning.dark' : 'text.secondary' }}>
                {countdownText}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {NOT_ON_FILE}
          </Typography>
        )}
      </Box>
      <Box role="cell" sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-end', sm: 'stretch' }, gap: 0.5, minWidth: 0 }} data-testid="league-row-played">
        {matchCount === 0 ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', whiteSpace: 'nowrap' }}>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{NOT_ON_FILE}</Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }} {...DESKTOP_ONLY}>No matches scheduled</Box>
            </Typography>
            <Box sx={{ ...desktopOnly, height: 6, borderRadius: 3, bgcolor: 'grey.200', border: 1, borderStyle: 'dashed', borderColor: 'divider' }} {...DESKTOP_ONLY} />
          </>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{`${playedCount}/${matchCount}`}</Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }} {...DESKTOP_ONLY}>{`${playedCount} of ${matchCount}`}</Box>
            </Typography>
            <Box sx={{ ...desktopOnly, height: 6, borderRadius: 3, bgcolor: 'grey.300', overflow: 'hidden' }} {...DESKTOP_ONLY}>
              <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: 'primary.main' }} />
            </Box>
          </>
        )}
      </Box>
      <Box role="cell" sx={{ ...desktopOnly, textAlign: 'center' }} {...DESKTOP_ONLY} data-testid="league-row-status">
        <Chip size="small" label={league.active ? 'Active' : 'Inactive'} sx={{ ...badgeSx(league.active ? 'active' : 'muted'), height: 22, fontSize: '0.75rem' }} />
      </Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, color: 'primary.main' }}>
        <LeagueRowMenu league={league} seasonId={seasonId} onShare={onShare} onDuplicate={onDuplicate} testId="league-row-actions" />
      </Box>
    </Box>
  )
}

// docs/specs/091-leagues-gold-standard.md (A): the list view of the Leagues page, built like PlayerTable, MatchTable and
// PollTable: one bordered panel with a header row that sticks to the top of the scrolling page and zebra rows; the whole
// row opens the league's Schedule for the chosen season. A phone keeps League, Played and the actions button.
export function LeagueTable({ leagues, seasonId, onShare, onDuplicate, toolbar, empty }: LeagueTableProps) {
  const table = (
    <Box
      role="table"
      aria-label="Leagues"
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
        <Box role="columnheader">League</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Format</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Teams</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Next match</Box>
        <Box role="columnheader" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Played</Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }} {...DESKTOP_ONLY}>Matches played</Box>
        </Box>
        <Box role="columnheader" sx={{ ...desktopOnly, textAlign: 'center' }} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" aria-label="Actions" />
      </Box>
      <Box role="rowgroup">
        {leagues.map((league) => (
          <LeagueRow key={league.id} league={league} seasonId={seasonId} onShare={onShare} onDuplicate={onDuplicate} />
        ))}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="leagues-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {leagues.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return (
    <>
      {table}
    </>
  )
}
