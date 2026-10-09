import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { badgeSx } from '../../../components/RecordCard'
import { useCountdown } from '../../../components/Countdown'
import { LEAGUE_FORMAT_LABELS } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'
import { zebraTint } from '../../../utils/zebraTint'
import { formatMatchDateTime } from '../availability/pollHelpers'

export interface LeagueTableProps {
  leagues: League[]
  // The chosen season, carried into the league page.
  seasonId?: string
}

const NOT_ON_FILE = '–'

// Desktop: League, Format, Teams, Next match, Matches played, Status, chevron. A phone keeps League, Played and the chevron.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 64px 32px',
  sm: 'minmax(220px, 2fr) 90px 70px minmax(170px, 1.2fr) minmax(190px, 1.3fr) 100px 32px',
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

function LeagueRow({ league, seasonId }: { league: League; seasonId?: string }) {
  const next = useCountdown(league.nextMatchDate)
  const soon = next.stage !== 'none' && next.stage !== 'expired' && next.warn
  const matchCount = league.matchCount ?? 0
  const playedCount = league.playedCount ?? 0
  const teamCount = league.teams?.length ?? 0
  const percent = matchCount > 0 ? Math.min(100, (playedCount / matchCount) * 100) : 0
  const countdownText = next.stage === 'none' ? '' : next.stage === 'expired' ? 'Starting now' : `in ${next.text}`
  const to = `/manage/fixtures/leagues/${league.id}/schedule${seasonId ? `?seasonId=${seasonId}` : ''}`

  return (
    <Box
      role="row"
      data-testid="league-row"
      data-tone={soon ? 'warning' : 'neutral'}
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
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, justifyContent: { xs: 'flex-end', sm: 'flex-start' } }} data-testid="league-row-played">
        {matchCount === 0 ? (
          <Typography variant="caption" color="text.secondary">
            {NOT_ON_FILE}
          </Typography>
        ) : (
          <>
            <Box sx={{ ...desktopOnly, flex: 1, height: 6, borderRadius: 3, bgcolor: 'grey.300', overflow: 'hidden' }} {...DESKTOP_ONLY}>
              <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: 'primary.main' }} />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{`${playedCount}/${matchCount}`}</Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }} {...DESKTOP_ONLY}>{`${playedCount} of ${matchCount}`}</Box>
            </Typography>
          </>
        )}
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="league-row-status">
        <Chip size="small" label={league.active ? 'Active' : 'Inactive'} sx={{ ...badgeSx(league.active ? 'active' : 'muted'), height: 22, fontSize: '0.75rem' }} />
      </Box>
      <Box role="cell" aria-hidden sx={{ display: 'flex', justifyContent: 'center', color: 'primary.main' }}>
        <ChevronRightOutlinedIcon fontSize="small" />
      </Box>
    </Box>
  )
}

// docs/specs/091-leagues-gold-standard.md (A): the list view of the Leagues page, built like PlayerTable, MatchTable and
// PollTable: one bordered panel with a header row that sticks to the top of the scrolling page and zebra rows; the whole
// row opens the league's Schedule for the chosen season. A phone keeps League, Played and the chevron.
export function LeagueTable({ leagues, seasonId }: LeagueTableProps) {
  return (
    <Box
      role="table"
      aria-label="Leagues"
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
        <Box role="columnheader">League</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Format</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Teams</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Next match</Box>
        <Box role="columnheader" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Played</Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }} {...DESKTOP_ONLY}>Matches played</Box>
        </Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" aria-label="Open" />
      </Box>
      <Box role="rowgroup">
        {leagues.map((league) => (
          <LeagueRow key={league.id} league={league} seasonId={seasonId} />
        ))}
      </Box>
    </Box>
  )
}
