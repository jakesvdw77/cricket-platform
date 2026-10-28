import { useState } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { CompactSwitch } from '../../../components/CompactSwitch'
import type { MyLeagueDto } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { LeagueLogo } from './HubLeagueCard'
import { emptyLine, tagSx } from './HubLeagueTabs'
import { groupByDate, isPast, longDate, shortDate, timeLabel } from './leagueFormat'

// docs/specs/123 (Schedule and Results tabs): the whole league schedule and the published results. A row that is the player's
// team's game has a gold left edge, a tinted ground and the text tag "Your game"; "Only my games" (off, not remembered) filters.
const rowSx = (mine: boolean, dim = false) =>
  ({
    display: 'grid',
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
      <LeagueLogo logoUrl={logoUrl} size={28} />
      <Typography sx={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{name}</Typography>
    </Box>
  )
}

const YourGame = () => <Chip size="small" label="Your game" sx={{ ...tagSx, justifySelf: 'start' }} />

export function HubLeagueSchedule({ dto }: { dto: MyLeagueDto }) {
  const [onlyMine, setOnlyMine] = useState(false)
  if (dto.schedule.length === 0) return <Box sx={emptyLine}>No matches scheduled yet.</Box>
  const rows = dto.schedule.filter((row) => !onlyMine || row.mine)
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <OnlyMine checked={onlyMine} onChange={setOnlyMine} />
      {rows.length === 0 && <Box sx={emptyLine}>None of your games are scheduled yet.</Box>}
      {groupByDate(rows).map((group) => (
        <Box key={group.date} component="section" aria-label={longDate(group.date)} sx={{ display: 'grid', gap: 1 }}>
          <Typography component="h3" sx={{ fontSize: 16, fontWeight: 600, color: HUB.sand }}>{longDate(group.date)}</Typography>
          {group.rows.map((row) => (
            <Box key={row.matchId} component="article" data-mine={row.mine ? 'true' : undefined} sx={rowSx(row.mine, isPast(row.date))}>
              {row.mine && <YourGame />}
              <Box sx={{ display: 'grid', gap: 0.5 }}>
                <Side name={row.homeName} logoUrl={row.homeLogoUrl} />
                <Typography sx={{ fontSize: 14, color: HUB.muted, pl: 0.5 }}>versus</Typography>
                <Side name={row.awayName} logoUrl={row.awayLogoUrl} />
              </Box>
              <Typography sx={{ fontSize: 15, color: HUB.muted }}>{[timeLabel(row.time), row.venue].filter(Boolean).join(' · ')}</Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export function HubLeagueResults({ dto }: { dto: MyLeagueDto }) {
  const [onlyMine, setOnlyMine] = useState(false)
  if (dto.results.length === 0) return <Box sx={emptyLine}>No results published yet.</Box>
  // Newest first.
  const rows = [...dto.results].filter((row) => !onlyMine || row.mine).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <OnlyMine checked={onlyMine} onChange={setOnlyMine} />
      {rows.length === 0 && <Box sx={emptyLine}>None of your games have a published result yet.</Box>}
      {rows.map((row) => (
        <Box key={row.matchId} component="article" data-mine={row.mine ? 'true' : undefined} sx={rowSx(row.mine)}>
          {row.mine && <YourGame />}
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
        </Box>
      ))}
    </Box>
  )
}
