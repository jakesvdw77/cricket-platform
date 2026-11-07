import { useMemo } from 'react'
import { Alert, Box, Link, Skeleton, Typography } from '@mui/material'
import { Button } from '../../../components/Button'
import { BrandIcon } from '../../../components/BrandIcon'
import { useMyPlayer } from '../../../api/myPlayersApi'
import { useMyPlayerResults, useMyPlayerResultsFilters, useMyPlayerResultsSummary } from '../../../api/meResultsApi'
import type { MyResultSummary } from '../../../api/meResultsApi'
import { BRAND, creamAlpha } from '../../../brandTokens'
import { HubPageHeader } from './HubPageHeader'
import { HubScopePanel, HubScopeSheet, useHubScope } from './HubScopeControls'
import { HUB, hubOutlineButton } from './hubStyle'
import { HubResultCard } from './HubResultCard'
import { bigSx, cardSx, kickerSx } from './resultCardStyle'
import { chipFigure, formSentence, opponentCode, resultTone, streakLetter, versusText } from './resultsFormat'

// docs/specs/145 decisions 11 and 14 (rounds 5 and 6 of the mockups): the Season dropdown and a Filters button in the header (the
// equal-size Leagues and Teams chips live in a docked side panel from lg and a dark bottom sheet below it, choices apply as you tap;
// chosen filters show as removable tags; a player with nothing to choose gets a quiet line instead), a Recent Form card, the latest result as a banner and a responsive grid of wide
// result cards. No carousel. Read only; the footer owns Back. The scope lives in the URL (season, league, team, competition), saved
// per player on this device as the fallback; the server pages the rows (Show More), the browser never slices them.
// docs/specs/147: the scope controls are the shared HubScopeControls, extracted from this page with no change in behaviour.

function Skeletons() {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }} aria-busy="true" data-testid="hub-results-loading">
      <Skeleton variant="rounded" height={110} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '20px' }} />
      <Skeleton variant="rounded" height={190} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '20px' }} />
      <Skeleton variant="rounded" height={190} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '20px' }} />
    </Box>
  )
}

const chipColours = (tone: ReturnType<typeof resultTone>) =>
  tone === 'win' ? { bgcolor: BRAND.gold, color: BRAND.ink } : tone === 'loss' ? { bgcolor: '#7b3a3a', color: BRAND.cream } : tone === 'tie' ? { bgcolor: BRAND.sand, color: BRAND.ink } : { bgcolor: creamAlpha(0.22), color: BRAND.cream }

function RecentForm({ rows }: { rows: MyResultSummary['lastFive'] }) {
  const streak = [...rows].reverse()
  return (
    <Box component="section" aria-label="Recent Form" data-testid="hub-results-form" sx={{ ...cardSx('neutral'), p: 2, borderRadius: '20px', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ ...kickerSx, fontSize: 14 }}>Recent Form</Typography>
          <Typography data-testid="form-sentence" sx={{ fontSize: 15, mt: 0.75 }}>{formSentence(rows)}</Typography>
        </Box>
        <Box data-testid="form-streak" sx={{ display: 'flex', gap: 1, ml: { sm: 'auto' } }}>
          {streak.map((row) => (
            <Box key={row.matchId} sx={{ textAlign: 'center', width: 50 }}>
              <Box aria-label={`${row.result.toLowerCase().replace('_', ' ')} ${versusText(row)}`} role="img" sx={{ ...chipColours(resultTone(row.result)), width: 46, height: 46, mx: 'auto', borderRadius: '14px', display: 'grid', placeItems: 'center', fontFamily: HUB.display, fontSize: 21, fontWeight: 700 }}>
                {streakLetter(row.result)}
              </Box>
              <Typography sx={{ fontSize: 12, color: HUB.muted, mt: 0.375 }}>{chipFigure(row)}</Typography>
              <Typography sx={{ fontSize: 11, color: HUB.muted, letterSpacing: '0.04em' }}>{opponentCode(row)}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

export function HubResults({ playerKey }: { playerKey: string }) {
  const player = useMyPlayer(playerKey).data
  const filtersQuery = useMyPlayerResultsFilters(playerKey)
  const filters = filtersQuery.data
  const controls = useHubScope({ playerKey, storageKey: `hubResults:filters:${playerKey}`, filters })
  const { scope, narrowed, scopeText, query, clearFilters } = controls

  const ready = Boolean(filters)
  const list = useMyPlayerResults(playerKey, scope, ready)
  const summaryQuery = useMyPlayerResultsSummary(playerKey, scope, ready)
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.rows) ?? [], [list.data])
  const summary = summaryQuery.data
  const playerName = player?.firstName ?? 'This Player'

  const failed = filtersQuery.isError || list.isError || summaryQuery.isError
  const header = <HubPageHeader title="Results" context={failed ? undefined : controls.context} actions={controls.actions} />

  let body
  if (failed) {
    body = (
      <Alert
        severity="error"
        action={
          <Button
            variant="secondary"
            size="compact"
            onClick={() => {
              void filtersQuery.refetch()
              void list.refetch()
              void summaryQuery.refetch()
            }}
          >
            Retry
          </Button>
        }
      >
        We could not load the results. Please try again.
      </Alert>
    )
  } else if (!filters || list.isLoading || summaryQuery.isLoading || !summary) {
    body = <Skeletons />
  } else if (rows.length === 0 && narrowed) {
    body = (
      <Box data-testid="hub-results-filtered-empty" sx={{ ...cardSx('neutral'), alignItems: 'center', textAlign: 'center', py: 4, gap: 1.5 }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ ...bigSx, fontSize: 40 }}>No matches for this filter</Typography>
        <Typography sx={{ fontSize: 16, maxWidth: 320, color: HUB.muted }}>{scopeText} has no results shared with the Player Hub.</Typography>
        <Link component="button" type="button" underline="always" onClick={clearFilters} sx={{ color: HUB.gold, fontSize: 16, minHeight: 44 }}>
          Clear Filters
        </Link>
      </Box>
    )
  } else if (rows.length === 0) {
    body = (
      <Box data-testid="hub-results-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>No results yet</Typography>
        <Typography sx={{ fontSize: 15 }}>Finished matches will appear here once the club shares them.</Typography>
      </Box>
    )
  } else {
    body = (
      <Box sx={{ display: 'grid', gap: 1.75, minWidth: 0, opacity: list.isPlaceholderData ? 0.55 : 1 }}>
        {summary.lastFive.length > 0 && <RecentForm rows={summary.lastFive} />}
        <HubResultCard latest playerKey={playerKey} playerName={playerName} row={rows[0]} scopeQuery={query} />
        {rows.length > 1 && (
          <Box data-testid="hub-results-grid" sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(310px, 1fr))' } }}>
            {rows.slice(1).map((row) => (
              <HubResultCard key={row.matchId} playerKey={playerKey} playerName={playerName} row={row} scopeQuery={query} />
            ))}
          </Box>
        )}
        {list.hasNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="secondary" size="compact" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} sx={{ ...hubOutlineButton, alignSelf: 'center' }}>
              {list.isFetchingNextPage ? 'Loading...' : 'Show More'}
            </Button>
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box data-testid="hub-results" sx={{ display: 'grid', gridTemplateColumns: controls.panelOpen ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)', gap: controls.panelOpen ? 2.5 : 0, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}>
        {header}
        {body}
      </Box>
      <HubScopePanel controls={controls} />
      <HubScopeSheet controls={controls} matchCount={summary?.matches} />
    </Box>
  )
}
