import type { ReactNode } from 'react'
import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { alpha, lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { ManageMenu } from '../../../components/ManageMenu'
import { badgeSx } from '../../../components/RecordCard'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import { initialsFromName } from '../../../utils/initials'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { zebraTint } from '../../../utils/zebraTint'
import { fixtureSideName, isOurMatch } from './leagueFixtureFilters'

export interface LeagueFixturesTableProps {
  matches: Match[]
  teamsById: Map<string, Team>
  // docs/standards/page-anatomy.md section 3: the page's filter bar. Given, the table renders ONE card: this toolbar row, a hairline, then the
  // header and rows (the table has no outer border of its own). Omitted, as before.
  toolbar?: ReactNode
  // With a toolbar and no rows: this message replaces the table inside the same card, so the toolbar never remounts.
  empty?: ReactNode
  // docs/specs/127: the name of the page this table is on, for the "Back to ..." of the match pages it opens (default "Schedule").
  originLabel?: string
  // docs/specs/131: opens the Share Match dialog for one of our matches. Omitted, the row's Share Match item is disabled.
  onShare?: (match: Match) => void
}

// Desktop: When, Home, Away, Venue, a chip, the actions button (Home and Away equal width so the names line up down the rows). A phone keeps
// one Match cell (the names on one line, the time and venue under them) and the actions button. The row has no chevron: the whole row is
// the link (hover tint and pointer are the cue).
const COLUMNS = {
  xs: 'minmax(0, 1fr) 44px',
  sm: '120px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 100px 36px',
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  columnGap: { xs: 0.75, sm: 1.5 },
  px: 1.5,
} as const

const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
const phoneOnly = { display: { xs: 'flex', sm: 'none' } } as const
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

const cardSx = { border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 0, overflow: 'clip' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

const nameSx = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } as const

function SideLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <Avatar
      variant="rounded"
      src={logoUrl ?? undefined}
      alt=""
      sx={{
        width: 32,
        height: 32,
        flex: 'none',
        fontSize: '0.65rem',
        fontWeight: 700,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
        color: 'primary.dark',
        borderRadius: 1,
      }}
    >
      {initialsFromName(name)}
    </Avatar>
  )
}

function SideCell({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <SideLogo name={name} logoUrl={logoUrl} />
      <Typography variant="body2" fontWeight={600} component="span" title={name} sx={nameSx}>
        {name}
      </Typography>
    </Box>
  )
}

function FixtureRow({ match, teamsById, originLabel, onShare }: { match: Match; teamsById: Map<string, Team>; originLabel: string; onShare?: (match: Match) => void }) {
  const location = useLocation()
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), originLabel)
  const homeName = fixtureSideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayName = fixtureSideName(match.awayTeamId, match.awayTeamName, teamsById)
  const homeLogo = match.homeTeamId ? (teamsById.get(match.homeTeamId)?.logoUrl ?? null) : match.homeTeamLogoUrl
  const awayLogo = match.awayTeamId ? (teamsById.get(match.awayTeamId)?.logoUrl ?? null) : match.awayTeamLogoUrl
  const date = new Date(match.matchDate)
  const day = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const ours = isOurMatch(match)
  const title = `${homeName} vs ${awayName}`
  // The phone shows one line "[badge] Home vs [badge] Away"; from sm each team has its own cell. The row's title is the link's
  // accessible name (a single overlay link for the whole row, so it exists once whatever the breakpoint).
  const phoneSides = (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <SideLogo name={homeName} logoUrl={homeLogo} />
      <Box component="span" sx={nameSx}>
        {homeName}
      </Box>
      <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, flex: 'none' }}>
        vs
      </Box>
      <SideLogo name={awayName} logoUrl={awayLogo} />
      <Box component="span" sx={nameSx}>
        {awayName}
      </Box>
    </Box>
  )

  return (
    <Box
      role="row"
      data-testid="fixture-row"
      data-ours={ours ? 'true' : 'false'}
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 60, sm: 56 },
        '&:nth-of-type(even)': { bgcolor: zebraTint },
        ...(ours ? { '&:hover': { bgcolor: hoverTint } } : {}),
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      {ours && (
        // Stretched link over the whole row (docs/specs/059): the row is position: relative.
        <MuiLink
          component={RouterLink}
          to={leaveTo(`/manage/fixtures/matches/${match.id}`)}
          aria-label={title}
          underline="none"
          sx={{ position: 'absolute', inset: 0, zIndex: 0 }}
        />
      )}
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="fixture-row-when">
        <Typography variant="body2" fontWeight={600} component="div" noWrap>
          {day}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {time}
        </Typography>
      </Box>
      <Box role="cell" sx={{ ...phoneOnly, minWidth: 0 }} data-testid="fixture-row-phone-match">
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25, width: '100%' }}>
          <Typography variant="body2" fontWeight={600} component="div" sx={{ minWidth: 0 }}>
            {phoneSides}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap data-testid="fixture-row-phone-when">
            {`${day}, ${time}${match.venue ? ` · ${match.venue}` : ''}`}
          </Typography>
        </Box>
      </Box>
      <Box role="cell" sx={{ ...desktopOnly, minWidth: 0 }} {...DESKTOP_ONLY} data-testid="fixture-row-home">
        <SideCell name={homeName} logoUrl={homeLogo} />
      </Box>
      <Box role="cell" sx={{ ...desktopOnly, minWidth: 0 }} {...DESKTOP_ONLY} data-testid="fixture-row-away">
        <SideCell name={awayName} logoUrl={awayLogo} />
      </Box>
      <Typography role="cell" variant="body2" color="text.secondary" noWrap sx={desktopOnly} {...DESKTOP_ONLY} data-testid="fixture-row-venue">
        {match.venue ?? '–'}
      </Typography>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="fixture-row-ours">
        {ours && <Chip size="small" label="Our match" sx={{ ...badgeSx('positive'), height: 22, fontSize: '0.75rem' }} />}
      </Box>
      <Box role="cell" sx={{ display: 'flex', justifyContent: 'center' }}>
        {ours && (
          // Page-anatomy section 6: the row's one Actions button. Same set as the Matches list offers a row (it has no menu, so Open
          // and Edit); only our matches have a page to open or edit.
          <ManageMenu
            trigger="kebab"
            dense
            label={`Actions for ${title}`}
            testId={`fixture-row-actions-${match.id}`}
            groups={[
              {
                id: 'actions',
                heading: 'Actions',
                items: [
                  { id: 'open', title: 'Open Match', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: leaveTo(`/manage/fixtures/matches/${match.id}`) },
                  { id: 'edit', title: 'Edit Match', icon: <EditOutlinedIcon fontSize="small" />, to: leaveTo(`/manage/fixtures/matches/${match.id}/edit`) },
                  // Share is always last (page-anatomy section 8); it opens the Share Match dialog (docs/specs/131).
                  { id: 'share', title: 'Share Match', icon: <ShareOutlinedIcon fontSize="small" />, onClick: () => onShare?.(match), disabled: !onShare, reason: 'Sharing is not available here' },
                ],
              },
            ]}
          />
        )}
      </Box>
    </Box>
  )
}

// docs/specs/091 (C): the Schedule tab's fixtures as a zebra table (the standard of PlayerTable, MatchTable and PollTable):
// When, Home and Away (a logo beside each name), Venue and an "Our match" chip; our matches open the match, the others are plain
// rows. (The edit form's Schedule tab uses this table too.)
export function LeagueFixturesTable({ matches, teamsById, toolbar, empty, originLabel = 'Schedule', onShare }: LeagueFixturesTableProps) {
  const table = (
    <Box
      role="table"
      aria-label="Fixtures"
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
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>When</Box>
        <Box role="columnheader" sx={phoneOnly}>Match</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Home</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Away</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Venue</Box>
        <Box role="columnheader" sx={desktopOnly} aria-label="Ours" {...DESKTOP_ONLY} />
        <Box role="columnheader" aria-label="Actions" />
      </Box>
      <Box role="rowgroup">
        {matches.map((match) => (
          <FixtureRow key={match.id} match={match} teamsById={teamsById} originLabel={originLabel} onShare={onShare} />
        ))}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="fixtures-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {matches.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return (
    <>
      {table}
    </>
  )
}
