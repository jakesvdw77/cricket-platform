import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import { badgeSx } from '../../../components/RecordCard'
import type { RecordCardBadge } from '../../../components/RecordCard'
import { useCountdown } from '../../../components/Countdown'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { initialsFromName } from '../../../utils/initials'
import { zebraTint } from '../../../utils/zebraTint'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { announcedBadges, badgeFor, matchLeagueValue, pollBadgeFor, selectionRows, sideName } from './matchCardHelpers'

export interface MatchTableProps {
  matches: Match[]
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  // Where a row opens the match; absent (the squad picker) = the rows are not links.
  viewTo?: (match: Match) => string
}

const NOT_ON_FILE = '–'

// Desktop: When, Match, Selection, Announced, Poll, chevron. A phone keeps Match (with the time under the names),
// Picked and the chevron.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 54px 32px',
  sm: '150px minmax(220px, 2fr) 170px minmax(130px, 1fr) 110px 32px',
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

function StatusChip({ badge, height = 22 }: { badge: RecordCardBadge; height?: number }) {
  return (
    <Chip
      size="small"
      label={badge.label}
      variant={badge.tone === 'neutral' || badge.tone === 'noPoll' ? 'outlined' : 'filled'}
      sx={{ ...badgeSx(badge.tone), height, fontSize: '0.75rem' }}
    />
  )
}

function MatchRow({
  match,
  teamsById,
  leaguesById,
  seasonsById,
  viewTo,
}: {
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  viewTo?: string
}) {
  const home = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const away = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const title = `${home} vs ${away}`
  const kickoff = useCountdown(match.matchDate)
  const played = kickoff.stage === 'expired'
  const soon = !played && kickoff.warn
  const countdownText = played ? 'Played' : kickoff.text ? `in ${kickoff.text}` : ''
  const timeColor = soon ? 'warning.dark' : 'text.secondary'

  // The logo is the club's own side (home first); a match with no own side shows the home side's initials.
  const ownTeam = (match.homeTeamId && teamsById.get(match.homeTeamId)) || (match.awayTeamId && teamsById.get(match.awayTeamId)) || undefined
  const logoName = ownTeam ? ownTeam.name : home

  const rows = selectionRows(match, teamsById)
  const first = rows[0]
  // A standalone match has no league: "Friendly · 2026/27", as the mockup shows.
  const leagueValue = match.leagueId
    ? matchLeagueValue(match, leaguesById, seasonsById)
    : ['Friendly', seasonsById.get(match.seasonId)?.label].filter(Boolean).join(' · ')
  const inactive = badgeFor(match)
  const announced = announcedBadges(match, teamsById)
  const poll = pollBadgeFor(match.polls)
  const pickedText = (size: number | null, picked: number) => (size === null ? `${picked}` : `${picked}/${size}`)

  const titleNode = (
    <Typography variant="body2" fontWeight={600} noWrap component="div">
      {viewTo ? (
        // Stretched link over the whole row (docs/specs/059): the row is position: relative.
        <MuiLink component={RouterLink} to={viewTo} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
          {title}
        </MuiLink>
      ) : (
        title
      )}
    </Typography>
  )

  return (
    <Box
      role="row"
      data-testid="match-row"
      data-tone={soon ? 'warning' : 'neutral'}
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 60, sm: 56 },
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
        ...(viewTo ? { '&:hover': { bgcolor: hoverTint } } : {}),
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar
          variant="rounded"
          src={ownTeam ? (ownTeam.logoUrl ?? undefined) : undefined}
          sx={{ width: 36, height: 36, flex: 'none', fontSize: '0.7rem', fontWeight: 700, bgcolor: 'background.paper', color: 'primary.main', border: 1, borderColor: 'divider', borderRadius: 1.25 }}
        >
          {ownTeam?.abbreviation || initialsFromName(logoName)}
        </Avatar>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {titleNode}
          <Typography variant="caption" color="text.secondary" noWrap sx={desktopOnly} {...DESKTOP_ONLY}>
            {leagueValue}
          </Typography>
          <Typography variant="caption" noWrap sx={{ ...phoneOnly, color: timeColor }} data-testid="match-row-phone-when">
            {formatMatchDateTime(match.matchDate)}
            {countdownText ? ` · ${countdownText}` : ''}
          </Typography>
          {inactive && <Chip size="small" label={inactive.label} sx={{ ...badgeSx(inactive.tone), height: 20, fontSize: '0.6875rem', alignSelf: 'flex-start' }} />}
        </Box>
      </Box>
      {/* Cells are placed by DOM order on a desktop (When first); the phone grid hides it. */}
      <Box role="cell" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY} data-testid="match-row-when">
        <Typography variant="body2" fontWeight={600} component="div" noWrap sx={{ color: soon ? 'warning.dark' : 'text.primary' }}>
          {formatMatchDateTime(match.matchDate)}
        </Typography>
        {countdownText && (
          <Typography variant="caption" component="div" sx={{ color: timeColor }}>
            {countdownText}
          </Typography>
        )}
      </Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, justifyContent: { xs: 'flex-end', sm: 'flex-start' } }} data-testid="match-row-selection">
        {!first ? (
          <Typography variant="body2" color="text.secondary">
            {NOT_ON_FILE}
          </Typography>
        ) : (
          <>
            {first.playingXiSize !== null && (
              <Box sx={{ ...desktopOnly, flex: 1, height: 6, borderRadius: 3, bgcolor: 'grey.300', overflow: 'hidden' }} {...DESKTOP_ONLY}>
                <Box sx={{ width: `${Math.min(100, (first.picked / Math.max(first.playingXiSize, 1)) * 100)}%`, height: '100%', bgcolor: 'primary.main' }} />
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {rows.map((row) => pickedText(row.playingXiSize, row.picked)).join(' · ')}
            </Typography>
          </>
        )}
      </Box>
      <Box role="cell" sx={{ ...desktopOnly, display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }} {...DESKTOP_ONLY} data-testid="match-row-announced">
        {announced.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {NOT_ON_FILE}
          </Typography>
        ) : (
          announced.map((badge) => <StatusChip key={badge.label} badge={badge} />)
        )}
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="match-row-poll">
        <StatusChip badge={poll} />
      </Box>
      <Box role="cell" aria-hidden sx={{ display: 'flex', justifyContent: 'center', color: 'primary.main' }}>
        <ChevronRightOutlinedIcon fontSize="small" />
      </Box>
    </Box>
  )
}

// docs/specs/089 (C): the list view of the Matches page, built like PlayerTable (docs/specs/088 F): one bordered panel
// with a header row that sticks to the top of the scrolling page and zebra rows; the whole row opens the match. A
// phone keeps Match (the time under the names), Picked and the chevron.
export function MatchTable({ matches, teamsById, leaguesById, seasonsById, viewTo }: MatchTableProps) {
  return (
    <Box
      role="table"
      aria-label="Matches"
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
        <Box role="columnheader" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY}>When</Box>
        <Box role="columnheader">Match</Box>
        <Box role="columnheader" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>
          <Box component="span" sx={phoneOnly}>Picked</Box>
          <Box component="span" sx={desktopOnly} {...DESKTOP_ONLY}>Selection</Box>
        </Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Announced</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Poll</Box>
        <Box role="columnheader" aria-label="Open" />
      </Box>
      <Box role="rowgroup">
        {matches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            teamsById={teamsById}
            leaguesById={leaguesById}
            seasonsById={seasonsById}
            viewTo={viewTo ? viewTo(match) : undefined}
          />
        ))}
      </Box>
    </Box>
  )
}
