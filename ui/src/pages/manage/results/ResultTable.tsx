import type { ReactNode } from 'react'
import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { badgeSx } from '../../../components/RecordCard'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { ResultScoreLine } from '../../../components/ResultScoreLine'
import type { ResultListItem } from '../../../api/matchResultApi'
import type { Team } from '../../../api/teamApi'
import { initialsFromName } from '../../../utils/initials'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { inningsFor, resultLine, resultPerspective } from '../../../utils/resultLine'
import { zebraTint } from '../../../utils/zebraTint'
import { ownSidesOf, PERSPECTIVE_COLOR, resultSides, resultViewTo } from './resultListHelpers'

export interface ResultTableProps {
  items: ResultListItem[]
  teamsById: Map<string, Team>
  // docs/specs/138: the page's filter bar. Given, the table renders ONE flat card: this toolbar, a hairline, then the header and rows.
  toolbar?: ReactNode
  // With a toolbar and no rows: this message replaces the table inside the same card, so the toolbar never remounts.
  empty?: ReactNode
  // The row's actions button (ResultRowMenu), rendered in the last cell; it never navigates the row.
  renderActions?: (item: ResultListItem) => ReactNode
}

const NOT_ON_FILE = '–'

// Desktop: Date, Match, Result, Scores, Field, Status, chevron. A phone keeps Match (result line and date under the
// names), Status and the chevron.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 76px 44px',
  sm: '130px minmax(200px, 2fr) minmax(200px, 2fr) 190px minmax(120px, 1fr) 96px 44px',
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

// A flat card with a hairline and no shadow (page-anatomy section 3).
const cardSx = { border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 0, overflow: 'clip' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function ResultRow({ item, teamsById, actions }: { item: ResultListItem; teamsById: Map<string, Team>; actions?: ReactNode }) {
  const { match, result } = item
  const sides = resultSides(match, teamsById)
  const names = { home: sides[0].name, away: sides[1].name }
  const title = `${names.home} vs ${names.away}`
  const draft = result.status === 'DRAFT'
  const perspective = resultPerspective(result, ownSidesOf(match, teamsById))
  const line = resultLine(result, names)
  const field = result.playingAreaName ?? match.playingAreaName ?? match.venue
  // The logo is the club's own side (home first); a match with no own side shows the home side's.
  const own = ownSidesOf(match, teamsById)
  const logoSide = own.home || !own.away ? sides[0] : sides[1]

  return (
    <Box
      role="row"
      data-testid="result-row"
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 64, sm: 60 },
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
        '&:hover': { bgcolor: hoverTint },
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY}>
        <Typography variant="body2" fontWeight={600} component="div" noWrap>
          {formatMatchDateTime(match.matchDate)}
        </Typography>
      </Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar
          variant="rounded"
          src={logoSide.logo.src ?? undefined}
          sx={{ width: 36, height: 36, flex: 'none', fontSize: '0.75rem', fontWeight: 700, bgcolor: 'background.paper', color: 'primary.main', border: 1, borderColor: 'divider', borderRadius: 1.25 }}
        >
          {logoSide.logo.initials}
        </Avatar>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant="body2" fontWeight={600} noWrap component="div" sx={{ whiteSpace: { xs: 'normal', sm: 'nowrap' }, overflowWrap: 'anywhere' }}>
            {/* Stretched link over the whole row (docs/specs/059): the row is position: relative. */}
            <MuiLink component={RouterLink} to={resultViewTo(match.id)} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
              {title}
            </MuiLink>
          </Typography>
          <Typography variant="caption" noWrap sx={{ ...phoneOnly, whiteSpace: 'normal', color: PERSPECTIVE_COLOR[perspective], fontWeight: 600 }}>
            {line}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={phoneOnly}>
            {formatMatchDateTime(match.matchDate)}
          </Typography>
        </Box>
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="result-row-result">
        <Typography variant="body2" fontWeight={600} sx={{ color: PERSPECTIVE_COLOR[perspective] }}>
          {line}
        </Typography>
        {item.playerOfTheMatch && (
          <Typography variant="caption" color="text.secondary" component="div" noWrap data-testid="result-row-potm">
            Player of the match: {item.playerOfTheMatch}
          </Typography>
        )}
      </Box>
      <Box role="cell" sx={{ ...desktopOnly, display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 0.25 }} {...DESKTOP_ONLY} data-testid="result-row-scores">
        {sides.map((side) => (
          <Box key={side.side} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 28, flex: 'none', fontWeight: 700 }}>
              {side.logo.initials || initialsFromName(side.name)}
            </Typography>
            <ResultScoreLine
              innings={inningsFor(result.innings, side.side)}
              ballsPerOver={result.ballsPerOver}
              winner={result.outcomeType === 'WON' && result.winningSide === side.side}
            />
          </Box>
        ))}
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="result-row-field">
        <Typography variant="body2" noWrap color={field ? undefined : 'text.secondary'}>
          {field ?? NOT_ON_FILE}
        </Typography>
      </Box>
      <Box role="cell" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
        <Chip
          size="small"
          label={draft ? 'Draft' : 'Published'}
          sx={{ ...badgeSx(draft ? 'warning' : 'active'), height: 22, fontSize: '0.75rem' }}
        />
        {result.visibleToPlayers && (
          <Chip size="small" label="In Player Hub" data-testid="result-hub-chip" sx={{ ...badgeSx('positive'), height: 22, fontSize: '0.75rem' }} />
        )}
      </Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
        {actions}
      </Box>
    </Box>
  )
}

// docs/specs/100-match-results-core.md, revamped by docs/specs/138: the list view of the Results page, built like MatchTable and PollTable: one
// flat card (hairline, no shadow), a tinted header row that sticks to the top of the scrolling page, zebra rows, the whole row opens the
// result and the last cell is the row's kebab (no chevron). Given a toolbar, ONE card: the toolbar, a hairline, then the header and rows (or
// `empty`).
export function ResultTable({ items, teamsById, toolbar, empty, renderActions }: ResultTableProps) {
  const table = (
    <Box role="table" aria-label="Results" sx={toolbar ? undefined : cardSx}>
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
          fontSize: { xs: '0.75rem', sm: '0.75rem' },
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        <Box role="columnheader" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY}>Date</Box>
        <Box role="columnheader">Match</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Result</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Scores</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Field</Box>
        <Box role="columnheader">Status</Box>
        <Box role="columnheader" aria-label="Actions" />
      </Box>
      <Box role="rowgroup">
        {items.map((item) => (
          <ResultRow key={item.match.id} item={item} teamsById={teamsById} actions={renderActions?.(item)} />
        ))}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="results-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {items.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return table
}
