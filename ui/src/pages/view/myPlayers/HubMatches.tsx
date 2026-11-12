import { useState } from 'react'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { BrandIcon } from '../../../components/BrandIcon'
import type { BrandIconName } from '../../../components/BrandIcon'
import { useMyPlayerMatches } from '../../../api/myPlayersApi'
import type { MyMatchSummaryDto } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HubPageHeader } from './HubPageHeader'
import { HubPillStrip } from './HubPillStrip'
import type { HubPillItem } from './HubPillStrip'
import { HUB } from './hubStyle'
import { HubMatchRow } from './HubMatchRow'
import { groupByDate, longDate } from './leagueFormat'
import { MATCHES_TABS } from './matchFormat'
import type { MatchesTab } from './matchFormat'
import { useNow } from './useNow'

// docs/specs/135 (Schedule > Matches): a pill row (Live when a match is on, Upcoming, Recent, each with its count) and only the chosen
// list under it. Upcoming is grouped by date with a countdown; Recent is open, newest first, 10 at a time with Show More. The pill is
// kept in the URL (`?tab=`) and handed to a match page as `from`, so its Back returns to the same pill. Read only; the footer owns
// Back. A live match refetches every minute (the hook).
const PAGE = 10
const column = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 } as const

export function HubMatches({ playerKey, playerName }: { playerKey?: string; playerName: string }) {
  const [recentLimit, setRecentLimit] = useState(PAGE)
  const matches = useMyPlayerMatches(playerKey, { recentLimit })
  const [search, setSearch] = useSearchParams()
  const now = useNow()
  const data = matches.data

  const upcomingCount = data ? (data.upcomingTotal ?? data.upcoming.length) : 0
  const recentCount = data ? (data.recentTotal ?? data.recent.length) : 0
  const liveOn = Boolean(data && data.live.length > 0)
  const asked = search.get('tab')
  const requested = MATCHES_TABS.find((tab) => tab === asked)
  const fallback: MatchesTab = liveOn ? 'live' : upcomingCount > 0 ? 'upcoming' : 'recent'
  // Live is always a pill (owner, 2026-11-12) so its place never moves; it only pulses while a match is on.
  const tab: MatchesTab = requested ?? fallback

  const pills: HubPillItem[] = [
    { id: 'live', label: 'Live', live: liveOn, count: data?.live.length ?? 0 },
    { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
    { id: 'recent', label: 'Recent', count: recentCount },
  ]
  const from = `matches:${tab}`

  const list = (rows: MyMatchSummaryDto[]) => rows.map((row) => <HubMatchRow key={row.matchId} playerKey={playerKey as string} row={row} now={now} from={from} />)
  const none = (icon: BrandIconName, title: string, text: string) => (
    <Box data-testid="matches-none" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'center', gap: 1, py: 5, px: 2, textAlign: 'center', border: `1px dashed ${creamAlpha(0.25)}`, borderRadius: 2 }}>
      <BrandIcon name={icon} size={56} onDark />
      <Typography component="h3" sx={{ fontSize: 18, fontWeight: 600, color: HUB.sand }}>{title}</Typography>
      <Typography sx={{ fontSize: 15, color: HUB.muted, maxWidth: 420 }}>{text}</Typography>
    </Box>
  )
  const noLive = none('nav/ground-oval', 'No match is live right now', `When ${playerName} is playing, the score appears here and updates by itself.`)
  const noUpcoming = none('nav/upcoming-matches', 'No upcoming matches', `Fixtures for ${playerName} will show here as soon as the club schedules them.`)
  const noRecent = none('nav/match-results', 'No recent matches', `Finished matches for ${playerName} will show here once they have been played.`)

  let body
  if (matches.isLoading) {
    body = (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }} aria-busy="true">
        {[0, 1, 2].map((n) => <Skeleton key={n} variant="rounded" height={104} sx={{ bgcolor: creamAlpha(0.12) }} />)}
      </Box>
    )
  } else if (matches.isError || !playerKey) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => matches.refetch()}>Retry</Button>}>
        We could not load the matches. Please try again.
      </Alert>
    )
  } else if (data && data.live.length + upcomingCount + recentCount === 0) {
    body = (
      <Box data-testid="hub-matches-empty" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/cricket-leagues" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>No matches for {playerName} yet</Typography>
      </Box>
    )
  } else if (data) {
    body = (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
        <HubPillStrip compact label="Matches" items={pills} selectedId={tab} onSelect={(item) => setSearch({ tab: item.id }, { replace: true })} />
        {tab === 'live' && <Box data-testid="matches-live" sx={column}>{data.live.length > 0 ? list(data.live) : noLive}</Box>}
        {tab === 'upcoming' && (
          <Box data-testid="matches-upcoming" sx={{ ...column, gap: 2 }}>
            {data.upcoming.length === 0
              ? noUpcoming
              : groupByDate(data.upcoming).map((group) => (
                  <Box key={group.date} sx={column}>
                    <Typography component="h3" sx={{ fontSize: 16, fontWeight: 600, color: HUB.sand }}>{longDate(group.date)}</Typography>
                    {list(group.rows)}
                  </Box>
                ))}
          </Box>
        )}
        {tab === 'recent' && (
          <Box data-testid="matches-recent" sx={column}>
            {data.recent.length === 0 ? noRecent : list(data.recent)}
            {data.recent.length < recentCount && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Button variant="secondary" size="compact" data-testid="show-more" disabled={matches.isFetching} onClick={() => setRecentLimit((limit) => Math.min(limit + PAGE, 100))}>
                  Show More
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <HubPageHeader title="Matches" />
      {body}
    </Box>
  )
}
