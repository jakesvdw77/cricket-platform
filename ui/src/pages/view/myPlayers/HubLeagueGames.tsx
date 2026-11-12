import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { alpha } from '@mui/material/styles'
import { CompactSwitch } from '../../../components/CompactSwitch'
import type { MyLeagueDto } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { HubVenueLine, HubWeatherBadge } from './HubFixtureLocation'
import { LeagueLogo } from './HubLeagueCard'
import { emptyLine, tagSx } from './HubLeagueTabs'
import { groupByDate, isPast, longDate, shortDate, timeLabel } from './leagueFormat'
import { leagueFrom, matchPath } from './matchFormat'

// docs/specs/123 (Schedule and Results tabs): the whole league schedule and the published results. A row that is the player's
// team's game has a gold left edge, a tinted ground and the text tag "Your game"; "Only my games" (off, not remembered) filters.
const rowSx = (mine: boolean, dim = false) =>
  ({
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 0.5,
    p: 1.5,
    minHeight: 44,
    border: 1,
    borderColor: HUB.line,
    borderLeft: `4px solid ${mine ? HUB.gold : HUB.line}`,
    bgcolor: mine ? alpha(HUB.gold, 0.14) : creamAlpha(0.07),
    borderRadius: '4px',
    opacity: dim ? 0.72 : 1,
  }) as const

function OnlyMine({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <Box sx={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
      <CompactSwitch label="Only my games" checked={checked} onChange={onChange} />
    </Box>
  )
}

function Side({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <LeagueLogo logoUrl={logoUrl} size={28} name={name} />
      <Typography sx={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{name}</Typography>
    </Box>
  )
}

// docs/specs/135: a `mine` row is one tap target opening the match page (a stretched link; Get Directions sits above it); any other row
// opens nothing and has no tap cue. Without a player key (no way to build the link) every row is plain.
const tapSx = { position: 'relative', '&:hover': { bgcolor: alpha(HUB.gold, 0.2) }, '&:focus-within': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } } as const
const stretched = { color: 'inherit', textDecoration: 'none', outline: 'none', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.5, '&::after': { content: '""', position: 'absolute', inset: 0 } } as const

interface RowLink {
  playerKey?: string
  leagueId?: string
  tab: 'schedule' | 'results'
}

function RowBody({ link, matchId, label, tapped, children }: { link: RowLink; matchId: string; label: string; tapped: boolean; children: ReactNode }) {
  if (!tapped || !link.playerKey) return <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.5 }}>{children}</Box>
  const from = link.leagueId ? leagueFrom(link.leagueId, link.tab) : 'matches'
  return (
    <Box component={RouterLink} to={matchPath(link.playerKey, matchId, from)} aria-label={label} data-testid="hub-league-row-link" sx={stretched}>
      {children}
    </Box>
  )
}

const YourGame = () => <Chip size="small" label="Your game" sx={{ ...tagSx, justifySelf: 'start' }} />

export function HubLeagueSchedule({ dto, playerKey }: { dto: MyLeagueDto; playerKey?: string }) {
  const [onlyMine, setOnlyMine] = useState(false)
  if (dto.schedule.length === 0) return <Box sx={emptyLine}>No matches scheduled yet.</Box>
  const rows = dto.schedule.filter((row) => !onlyMine || row.mine)
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <OnlyMine checked={onlyMine} onChange={setOnlyMine} />
      {rows.length === 0 && <Box sx={emptyLine}>None of your games are scheduled yet.</Box>}
      {groupByDate(rows).map((group) => (
        <Box key={group.date} component="section" aria-label={longDate(group.date)} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 }}>
          <Typography component="h3" sx={{ fontSize: 16, fontWeight: 600, color: HUB.sand }}>{longDate(group.date)}</Typography>
          {group.rows.map((row) => (
            <Box key={row.matchId} component="article" data-mine={row.mine ? 'true' : undefined} sx={[rowSx(row.mine, isPast(row.date)), row.mine && playerKey ? tapSx : {}]}>
              {row.mine && <YourGame />}
              {!isPast(row.date) && (row.time || row.date) && (
                <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 0.5, pointerEvents: 'none' }}>
                  <Typography sx={{ fontSize: 15, color: HUB.muted }}>{timeLabel(row.time)}</Typography>
                  <HubWeatherBadge row={row} format={dto.league.format} />
                </Box>
              )}
              <RowBody link={{ playerKey, leagueId: dto.league.id, tab: 'schedule' }} matchId={row.matchId} label={`${row.homeName} versus ${row.awayName}`} tapped={row.mine}>
                <Side name={row.homeName} logoUrl={row.homeLogoUrl} />
                <Typography sx={{ fontSize: 14, color: HUB.muted, pl: 0.5 }}>versus</Typography>
                <Side name={row.awayName} logoUrl={row.awayLogoUrl} />
              </RowBody>
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <HubVenueLine row={row} venue={row.venue} withDirections={!isPast(row.date)} />
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export function HubLeagueResults({ dto, playerKey }: { dto: MyLeagueDto; playerKey?: string }) {
  const [onlyMine, setOnlyMine] = useState(false)
  if (dto.results.length === 0) return <Box sx={emptyLine}>No results published yet.</Box>
  // Newest first.
  const rows = [...dto.results].filter((row) => !onlyMine || row.mine).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <OnlyMine checked={onlyMine} onChange={setOnlyMine} />
      {rows.length === 0 && <Box sx={emptyLine}>None of your games have a published result yet.</Box>}
      {rows.map((row) => (
        <Box key={row.matchId} component="article" data-mine={row.mine ? 'true' : undefined} sx={[rowSx(row.mine), row.mine && playerKey ? tapSx : {}]}>
          {row.mine && <YourGame />}
          <RowBody link={{ playerKey, leagueId: dto.league.id, tab: 'results' }} matchId={row.matchId} label={`${row.homeName} versus ${row.awayName}`} tapped={row.mine}>
            <Typography sx={{ fontSize: 14, color: HUB.muted }}>{shortDate(row.date)}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
              <Typography sx={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{row.homeName}</Typography>
              <Typography sx={{ fontSize: 17, flex: 'none' }}>{row.homeScore}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
              <Typography sx={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{row.awayName}</Typography>
              <Typography sx={{ fontSize: 17, flex: 'none' }}>{row.awayScore}</Typography>
            </Box>
            {row.resultLine && <Typography sx={{ fontSize: 16, color: HUB.gold }}>{row.resultLine}</Typography>}
          </RowBody>
        </Box>
      ))}
    </Box>
  )
}
