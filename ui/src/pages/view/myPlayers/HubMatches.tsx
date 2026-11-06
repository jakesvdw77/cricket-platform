import { useState } from 'react'
import { Alert, Box, ButtonBase, Skeleton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { Button } from '../../../components/Button'
import { BrandIcon } from '../../../components/BrandIcon'
import { PulseDot } from '../../../components/RecordCard/RecordCard'
import { useMyPlayerMatches } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HubPageHeader } from './HubPageHeader'
import { HUB, hubHeading } from './hubStyle'
import { HubMatchRow } from './HubMatchRow'
import { groupByDate, longDate } from './leagueFormat'
import { useNow } from './useNow'

// docs/specs/135 (Schedule > Matches): Live Now (pinned first, only when a match is on), Upcoming (grouped by date, with a countdown)
// and Recent (collapsed until asked for). Read only; the footer owns Back. A live match refetches every minute (the hook).
export function HubMatches({ playerKey, playerName }: { playerKey?: string; playerName: string }) {
  const matches = useMyPlayerMatches(playerKey)
  const [recentOpen, setRecentOpen] = useState(false)
  const now = useNow()
  const data = matches.data

  let body
  if (matches.isLoading) {
    body = (
      <Box sx={{ display: 'grid', gap: 1.5 }} aria-busy="true">
        {[0, 1, 2].map((n) => <Skeleton key={n} variant="rounded" height={104} sx={{ bgcolor: creamAlpha(0.12) }} />)}
      </Box>
    )
  } else if (matches.isError || !playerKey) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => matches.refetch()}>Retry</Button>}>
        We could not load the matches. Please try again.
      </Alert>
    )
  } else if (data && data.live.length + data.upcoming.length + data.recent.length === 0) {
    body = (
      <Box data-testid="hub-matches-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/cricket-leagues" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>No matches for {playerName} yet</Typography>
      </Box>
    )
  } else if (data) {
    body = (
      <Box sx={{ display: 'grid', gap: 2 }}>
        {data.live.length > 0 && (
          <Box component="section" aria-labelledby="hub-matches-live" sx={{ display: 'grid', gap: 1 }}>
            <Typography id="hub-matches-live" component="h3" sx={{ ...hubHeading, fontSize: 17, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PulseDot />
              Live Now
            </Typography>
            {data.live.map((row) => <HubMatchRow key={row.matchId} playerKey={playerKey} row={row} now={now} />)}
          </Box>
        )}
        {data.upcoming.length > 0 && (
          <Box component="section" aria-labelledby="hub-matches-upcoming" sx={{ display: 'grid', gap: 1 }}>
            <Typography id="hub-matches-upcoming" component="h3" sx={{ ...hubHeading, fontSize: 17 }}>Upcoming</Typography>
            {groupByDate(data.upcoming).map((group) => (
              <Box key={group.date} sx={{ display: 'grid', gap: 1 }}>
                <Typography component="h4" sx={{ fontSize: 16, fontWeight: 600, color: HUB.sand }}>{longDate(group.date)}</Typography>
                {group.rows.map((row) => <HubMatchRow key={row.matchId} playerKey={playerKey} row={row} now={now} />)}
              </Box>
            ))}
          </Box>
        )}
        {data.recent.length > 0 && (
          <Box component="section" aria-label="Recent Matches" sx={{ display: 'grid', gap: 1 }}>
            <ButtonBase
              aria-expanded={recentOpen}
              aria-controls="hub-matches-recent"
              onClick={() => setRecentOpen((open) => !open)}
              data-testid="recent-toggle"
              sx={{ justifyContent: 'space-between', minHeight: 44, px: 1.5, border: 1, borderColor: HUB.line, borderRadius: '4px', fontSize: 15, fontWeight: 600, color: HUB.cream, '&:hover': { bgcolor: creamAlpha(0.08) }, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
            >
              Recent Matches
              {recentOpen ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
            </ButtonBase>
            {recentOpen && (
              <Box id="hub-matches-recent" sx={{ display: 'grid', gap: 1 }}>
                {data.recent.map((row) => <HubMatchRow key={row.matchId} playerKey={playerKey} row={row} now={now} />)}
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <HubPageHeader title="Matches" />
      {body}
    </Box>
  )
}
