import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { MyMatchDto } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HubDirectionsButton } from './HubFixtureLocation'
import { HUB } from './hubStyle'
import { timeLabel } from './leagueFormat'
import { countdownLabel, dayLabel, elapsedLabel, selectionLabel } from './matchFormat'

// docs/specs/135 (Match page, figures): four static compact counters, no icons, never clickable. Same job as the manager page's
// PageCounters, drawn in Hub tokens on the dark console.
function Figure({ id, label, value, note, aside }: { id: string; label: string; value: string; note?: string; aside?: ReactNode }) {
  return (
    <Box data-testid={`match-figure-${id}`} sx={{ flex: '1 1 150px', minWidth: 0, minHeight: 46, border: 1, borderColor: HUB.line, borderRadius: '6px', px: 1.5, py: 0.75, bgcolor: creamAlpha(0.07), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'center', minWidth: 0 }}>
      <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.muted }}>
        {label}
        {note ? `, ${note}` : ''}
      </Typography>
      <Typography component="span" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 19, color: HUB.gold, overflowWrap: 'anywhere' }}>{value}</Typography>
      </Box>
      {aside}
    </Box>
  )
}

export function HubMatchFigures({ match, now }: { match: MyMatchDto; now: Date }) {
  const live = match.phase === 'LIVE'
  const played = match.status === 'PLAYED' || Boolean(match.result)
  const when = [dayLabel(match.date), timeLabel(match.time)].filter(Boolean).join(' ')
  const leagueSeason = [match.league?.name, match.season?.name].filter(Boolean).join(' · ') || 'Friendly'
  return (
    <Box data-testid="match-figures" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {live ? (
        <Figure id="when" label="When" value={elapsedLabel(match.startedAt, now) || when} />
      ) : (
        <Figure id="when" label="When" value={when} note={match.phase === 'UPCOMING' ? countdownLabel(match.date, now) : undefined} />
      )}
      <Figure
        id="where"
        label="Where"
        value={match.playingAreaName || match.venue || 'TBC'}
        aside={match.phase !== 'RECENT' ? <HubDirectionsButton row={match} venue={match.venue} /> : undefined}
      />
      <Figure id="league" label="League And Season" value={leagueSeason} />
      <Figure id="status" label="Your Status" value={played ? 'Played' : selectionLabel(match.selection)} />
    </Box>
  )
}
