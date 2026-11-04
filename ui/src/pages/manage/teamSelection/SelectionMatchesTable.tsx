import type { ReactNode } from 'react'
import { Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { ManageMenu } from '../../../components/ManageMenu'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { badgeSx } from '../../../components/RecordCard'
import { ProgressMeter } from '../../../components/ProgressMeter'
import type { TeamSelectionMatch, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { zebraTint } from '../../../utils/zebraTint'
import { useMatchLocationItems } from '../../../hooks/useMatchLocationItems'
import { selectTeamPath } from './selectionLinks'
import { useSelectionMatch } from './useSelectionMatch'
import { sideMenuItems } from './sideMenuItems'
import { TeamNameLink } from './TeamNameLink'
import { STATUS_LABELS, STATUS_TONES } from './selectionStatus'

export interface SelectionMatchesTableProps {
  matches: TeamSelectionMatch[]
  // Announces a side (the Announce button of a side that is ready); absent, the button is not offered.
  onAnnounce?: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  // The side being announced right now (its button is disabled).
  announcingSideId?: string | null
  // Shares an announced side's team sheet (the row action of an announced side); absent, announced rows keep Select players.
  onShare?: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  // The match whose Share is loading (its button is disabled).
  sharingMatchId?: string | null
  // docs/specs/137: the page's filter bar. Given, the table renders ONE flat card: this toolbar, a hairline, then the header and rows (or `empty`).
  toolbar?: ReactNode
  // With a toolbar and no rows: this message replaces the table inside the same card, so the toolbar never remounts.
  empty?: ReactNode
  // docs/specs/137: given, each row's kebab also lists Get Directions and Show Weather Forecast (read from the match itself).
  clubId?: string
  leagueFormatFor?: (leagueId: string | null) => string | null
}

// docs/specs/093-team-selection-hub.md, revamped by docs/specs/137: the flat zebra table of the Matches view - one row per club side (a derby has
// two). Desktop: When, Match, Team, Selection, Status, then the actions (a ready side's quick Announce Team button and the row's one
// kebab). A phone keeps Match (the time under it), Picked and the kebab. The whole row opens the Select Team page; no chevron.
// Compact row action: the theme's small button is too tall for a dense table row.
const rowActionSx = { whiteSpace: 'nowrap', minHeight: 28, py: 0.25, px: 1.5, fontSize: '0.75rem', lineHeight: 1.5 } as const

const COLUMNS = {
  xs: 'minmax(0, 1fr) 54px 44px',
  sm: '150px minmax(200px, 2fr) minmax(110px, 1fr) 170px 150px 190px',
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

function SideRow({
  match,
  side,
  onAnnounce,
  announcing,
  onShare,
  sharing,
  clubId,
  leagueFormat,
}: {
  clubId?: string
  leagueFormat?: string | null
  match: TeamSelectionMatch
  side: TeamSelectionSide
  onAnnounce?: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  announcing: boolean
  onShare?: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  sharing: boolean
}) {
  const to = selectTeamPath(match.matchId, side.sideId, side.home)
  const title = side.home ? `${side.teamName} v ${side.opponentName}` : `${side.opponentName} v ${side.teamName}`
  const when = formatMatchDateTime(match.matchDate)
  const max = side.limits.maxSelected
  const canAnnounce = side.status === 'READY_TO_ANNOUNCE' && side.sideId !== null && Boolean(onAnnounce)
  const fullMatch = useSelectionMatch(clubId, match.matchId, Boolean(clubId) && Boolean(match.venue))
  const { items: locationItems, dialogs: locationDialogs } = useMatchLocationItems(clubId, fullMatch, { title, leagueFormat })
  const items = sideMenuItems({
    side,
    selectTo: to,
    onAnnounce: onAnnounce ? () => onAnnounce(match, side) : undefined,
    announcing,
    onShare: onShare ? () => onShare(match, side) : undefined,
    sharing,
    locationItems,
  })
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
          <TeamNameLink sectionId={side.sectionId} teamId={side.teamId} name={side.teamName} />
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
          <ProgressMeter
            value={side.pickedCount}
            max={max}
            ariaLabel={`${side.teamName} selection, ${side.pickedCount} of ${max} picked`}
            testId={`selection-${match.matchId}-${side.teamId}`}
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
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, position: 'relative', zIndex: 1 }} data-testid="selection-row-action">
        {canAnnounce && (
          <Box sx={desktopOnly} {...DESKTOP_ONLY}>
            <Button size="compact" onClick={() => onAnnounce?.(match, side)} disabled={announcing} sx={rowActionSx}>
              {announcing ? 'Announcing…' : 'Announce Team'}
            </Button>
          </Box>
        )}
        <ManageMenu trigger="kebab" dense label={`Actions for ${title}`} testId={`selection-actions-${match.matchId}-${side.teamId}`} groups={[{ id: 'actions', heading: 'Actions', items }]} />
        {locationDialogs}
      </Box>
    </Box>
  )
}

export function SelectionMatchesTable({ matches, onAnnounce, announcingSideId = null, onShare, sharingMatchId = null, toolbar, empty, clubId, leagueFormatFor }: SelectionMatchesTableProps) {
  const table = (
    <Box role="table" aria-label="Team selection by match" sx={toolbar ? undefined : cardSx}>
      <Box
        role="row"
        sx={{
          ...gridSx,
          position: 'sticky',
          top: 0,
          zIndex: 2,
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
        <Box role="columnheader" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY}>When</Box>
        <Box role="columnheader">Match</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Team</Box>
        <Box role="columnheader" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>
          <Box component="span" sx={phoneOnly}>Picked</Box>
          <Box component="span" sx={desktopOnly} {...DESKTOP_ONLY}>Selection</Box>
        </Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" aria-label="Actions" />
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
              onShare={onShare}
              sharing={sharingMatchId === match.matchId}
              clubId={clubId}
              leagueFormat={leagueFormatFor?.(match.leagueId) ?? null}
            />
          )),
        )}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="selection-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {matches.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return table
}
