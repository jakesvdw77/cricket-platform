import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { alpha, lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import { badgeSx } from '../../../components/RecordCard'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import { initialsFromName } from '../../../utils/initials'
import { zebraTint } from '../../../utils/zebraTint'
import { fixtureSideName, isOurMatch } from './leagueFixtureFilters'

export interface LeagueFixturesTableProps {
  matches: Match[]
  teamsById: Map<string, Team>
}

// Desktop: When, Match, Venue, a chip, chevron. A phone keeps Match (the time and venue under the names) and the chevron.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 32px',
  sm: '150px minmax(260px, 2fr) minmax(140px, 1fr) 110px 32px',
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  columnGap: { xs: 0.75, sm: 1.5 },
  px: 1.5,
} as const

const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

const nameSx = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } as const
const srOnly = { position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } as const

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

function FixtureRow({ match, teamsById }: { match: Match; teamsById: Map<string, Team> }) {
  const homeName = fixtureSideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayName = fixtureSideName(match.awayTeamId, match.awayTeamName, teamsById)
  const homeLogo = match.homeTeamId ? (teamsById.get(match.homeTeamId)?.logoUrl ?? null) : match.homeTeamLogoUrl
  const awayLogo = match.awayTeamId ? (teamsById.get(match.awayTeamId)?.logoUrl ?? null) : match.awayTeamLogoUrl
  const date = new Date(match.matchDate)
  const day = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const ours = isOurMatch(match)
  const title = `${homeName} vs ${awayName}`
  // Each team's badge sits in front of its own name: [badge] Home vs [badge] Away. The whole title is also kept as screen
  // reader text, so the row reads "Home vs Away" however the visual pieces wrap or truncate.
  const sides = (
    <>
      <Box component="span" aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
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
      <Box component="span" sx={srOnly}>
        {title}
      </Box>
    </>
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
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
        ...(ours ? { '&:hover': { bgcolor: hoverTint } } : {}),
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant="body2" fontWeight={600} component="div" sx={{ minWidth: 0 }}>
            {ours ? (
              // Stretched link over the whole row (docs/specs/059): the row is position: relative.
              <MuiLink
                component={RouterLink}
                to={`/manage/fixtures/matches/${match.id}`}
                color="inherit"
                underline="none"
                aria-label={title}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, '&::after': { content: '""', position: 'absolute', inset: 0 } }}
              >
                {sides}
              </MuiLink>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>{sides}</Box>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: 'block', sm: 'none' } }} data-testid="fixture-row-phone-when">
            {`${day}, ${time}${match.venue ? ` · ${match.venue}` : ''}`}
          </Typography>
        </Box>
      </Box>
      <Box role="cell" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY} data-testid="fixture-row-when">
        <Typography variant="body2" fontWeight={600} component="div" noWrap>
          {day}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {time}
        </Typography>
      </Box>
      <Typography role="cell" variant="body2" color="text.secondary" noWrap sx={desktopOnly} {...DESKTOP_ONLY} data-testid="fixture-row-venue">
        {match.venue ?? '–'}
      </Typography>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="fixture-row-ours">
        {ours && <Chip size="small" label="Our match" sx={{ ...badgeSx('positive'), height: 22, fontSize: '0.75rem' }} />}
      </Box>
      <Box role="cell" aria-hidden sx={{ display: 'flex', justifyContent: 'center', color: 'primary.main' }}>
        {ours && <ChevronRightOutlinedIcon fontSize="small" />}
      </Box>
    </Box>
  )
}

// docs/specs/091 (C): the Schedule tab's fixtures as a zebra table (the standard of PlayerTable, MatchTable and PollTable):
// When, Match with a logo beside each team, Venue and an "Our match" chip; our matches open the match, the others are plain
// rows. (The edit form's Schedule tab keeps the LeagueFixtures list.)
export function LeagueFixturesTable({ matches, teamsById }: LeagueFixturesTableProps) {
  return (
    <Box
      role="table"
      aria-label="Fixtures"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 2, overflow: 'clip' }}
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
        <Box role="columnheader">Match</Box>
        <Box role="columnheader" sx={{ ...desktopOnly, order: -1 }} {...DESKTOP_ONLY}>When</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Venue</Box>
        <Box role="columnheader" sx={desktopOnly} aria-label="Ours" {...DESKTOP_ONLY} />
        <Box role="columnheader" aria-label="Open" />
      </Box>
      <Box role="rowgroup">
        {matches.map((match) => (
          <FixtureRow key={match.id} match={match} teamsById={teamsById} />
        ))}
      </Box>
    </Box>
  )
}
