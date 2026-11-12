import { useMemo, useState } from 'react'
import { Alert, Box, IconButton, Skeleton, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Button } from '../../../components/Button'
import { BrandIcon } from '../../../components/BrandIcon'
import { useMyPlayerMatches } from '../../../api/myPlayersApi'
import type { MyMatchSummaryDto } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HubPageHeader } from './HubPageHeader'
import { HUB } from './hubStyle'
import { HubMatchRow } from './HubMatchRow'
import { longDate, todayIso } from './leagueFormat'
import { useNow } from './useNow'

// Schedule > Calendar (owner, 2026-11-12): a month grid of every match the Matches list holds (live, upcoming and up to 100 recent).
// A day with games shows a dot per game (gold for the player's own, sand for the rest); tapping it lists that day's games under the grid
// with the same rows as Matches. Read only; the footer owns Back.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export function HubCalendar({ playerKey, playerName }: { playerKey?: string; playerName: string }) {
  const matches = useMyPlayerMatches(playerKey, { recentLimit: 100 })
  const now = useNow()
  const today = todayIso()
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))
  const [picked, setPicked] = useState<string | null>(today)

  const byDay = useMemo(() => {
    const map = new Map<string, MyMatchSummaryDto[]>()
    const d = matches.data
    for (const row of d ? [...d.live, ...d.upcoming, ...d.recent] : []) {
      const key = row.date.slice(0, 10)
      map.set(key, [...(map.get(key) ?? []), row])
    }
    return map
  }, [matches.data])

  const shift = (by: number) => setCursor(({ y, m }) => {
    const next = new Date(y, m + by, 1)
    return { y: next.getFullYear(), m: next.getMonth() }
  })

  const first = new Date(cursor.y, cursor.m, 1)
  const lead = (first.getDay() + 6) % 7 // Monday first
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  const monthLabel = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const dayRows = picked ? byDay.get(picked) ?? [] : []

  let body
  if (matches.isLoading) {
    body = <Skeleton variant="rounded" height={340} sx={{ bgcolor: creamAlpha(0.12) }} aria-busy="true" />
  } else if (matches.isError || !playerKey) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => matches.refetch()}>Retry</Button>}>
        We could not load the calendar. Please try again.
      </Alert>
    )
  } else {
    body = (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton aria-label="Previous month" onClick={() => shift(-1)} sx={{ color: HUB.sand, width: 44, height: 44 }}><ChevronLeftIcon /></IconButton>
          <Typography component="h2" data-testid="calendar-month" sx={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 600, color: HUB.sand }}>{monthLabel}</Typography>
          <IconButton aria-label="Next month" onClick={() => shift(1)} sx={{ color: HUB.sand, width: 44, height: 44 }}><ChevronRightIcon /></IconButton>
          <Button variant="secondary" size="compact" onClick={() => { setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); setPicked(today) }}>Today</Button>
        </Box>
        <Box role="grid" aria-label={monthLabel} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
          {WEEKDAYS.map((w) => <Typography key={w} role="columnheader" sx={{ textAlign: 'center', fontSize: 13, color: HUB.muted, pb: 0.5 }}>{w}</Typography>)}
          {cells.map((day, i) => {
            if (day === null) return <Box key={`b${i}`} role="gridcell" />
            const key = iso(cursor.y, cursor.m, day)
            const games = byDay.get(key) ?? []
            const mine = games.filter((g) => g.mine).length
            const selected = picked === key
            return (
              <Box
                key={key}
                role="gridcell"
                component="button"
                type="button"
                data-testid={`calendar-day-${key}`}
                aria-label={`${longDate(key)}, ${games.length === 0 ? 'no matches' : `${games.length} ${games.length === 1 ? 'match' : 'matches'}`}`}
                aria-pressed={selected}
                onClick={() => setPicked(key)}
                sx={{
                  display: 'grid', alignContent: 'space-between', justifyItems: 'center', gap: 0.5,
                  minHeight: { xs: 52, sm: 72 }, p: 0.75, cursor: 'pointer', font: 'inherit', color: HUB.sand,
                  border: key === today ? `2px solid ${HUB.gold}` : `1px solid ${selected ? HUB.gold : HUB.lineSoft}`,
                  borderRadius: '4px',
                  bgcolor: selected ? creamAlpha(0.18) : games.length ? creamAlpha(0.08) : 'transparent',
                  '&:hover': { bgcolor: creamAlpha(0.14) },
                  '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
                }}
              >
                <Typography component="span" sx={{ fontSize: 15, fontWeight: key === today ? 700 : 500 }}>{day}</Typography>
                <Box sx={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'center', minHeight: 8 }} aria-hidden="true">
                  {games.slice(0, 4).map((_g, n) => <Box key={n} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: n < mine ? HUB.gold : HUB.sand }} />)}
                </Box>
              </Box>
            )
          })}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, fontSize: 13, color: HUB.muted, alignItems: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: HUB.gold }} />{playerName}'s games</Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: HUB.sand }} />Other games</Box>
        </Box>
        {picked && (
          <Box data-testid="calendar-day-list" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 }}>
            <Typography component="h3" sx={{ fontSize: 16, fontWeight: 600, color: HUB.sand }}>{longDate(picked)}</Typography>
            {dayRows.length === 0 ? (
              <Box sx={{ display: 'grid', justifyItems: 'center', gap: 1, py: 4, px: 2, textAlign: 'center', border: `1px dashed ${creamAlpha(0.25)}`, borderRadius: 2 }}>
                <BrandIcon name="nav/upcoming-matches" size={48} onDark />
                <Typography sx={{ fontSize: 15, color: HUB.muted }}>No matches on this day.</Typography>
              </Box>
            ) : (
              dayRows.map((row) => <HubMatchRow key={row.matchId} playerKey={playerKey as string} row={row} now={now} from="matches" />)
            )}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <HubPageHeader title="Calendar" />
      {body}
    </Box>
  )
}
