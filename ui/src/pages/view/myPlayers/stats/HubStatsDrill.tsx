import { useMemo } from 'react'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Button } from '../../../../components/Button'
import { BrandIcon } from '../../../../components/BrandIcon'
import { useMyStatsInnings } from '../../../../api/meStatsApi'
import type { MyStatsDrillKind, MyStatsInningsRow } from '../../../../api/meStatsApi'
import type { MyResultDismissal } from '../../../../api/meResultsApi'
import { creamAlpha } from '../../../../brandTokens'
import { HubPageHeader } from '../HubPageHeader'
import { HUB, hubOutlineButton } from '../hubStyle'
import { cardSx } from '../resultCardStyle'
import { howOutWords, oversText, resultDate, resultTone, resultWord } from '../resultsFormat'
import { DASH, formatDecimal, plural, scoreText, wicketsForRuns } from './statsFormat'
import { scopeFromSearch, statsResultPath, statsScopeQuery } from './statsRoutes'

// docs/specs/147 (the match drill, stats/mine/innings?kind=&filter=&season=...): the innings, spells or matches behind a tile, a band or a
// slice of the My stats page. The kind and the filter are the server's tokens, taken from the address; the browser builds no query of its
// own and slices nothing (Show More asks the server for the next page). A row opens the Hub Result page with the stats origin, so Back
// returns to My Stats with the scope. The footer's Back ("Back to My Stats") is hubBack's stats case. Read only.
const KINDS: MyStatsDrillKind[] = ['BATTING', 'BOWLING', 'FIELDING', 'MATCHES']
const KIND_TITLE: Record<MyStatsDrillKind, string> = { BATTING: 'Batting Innings', BOWLING: 'Bowling Spells', FIELDING: 'Fielding', MATCHES: 'Matches' }

const parseKind = (text: string | null): MyStatsDrillKind => KINDS.find((kind) => kind === text) ?? 'BATTING'

const stretchedLink = { color: 'inherit', textDecoration: 'none', outline: 'none', '&::after': { content: '""', position: 'absolute', inset: 0 }, '&:focus-visible::after': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2, borderRadius: '22px' } } as const

// The figures of one row, as words: only the block of the row's kind is filled (a MATCHES row can fill all three).
function figuresOf(row: MyStatsInningsRow): string[] {
  const lines: string[] = []
  const { batting, bowling, fielding } = row
  if (batting) {
    const score = scoreText(batting.runs, batting.notOut)
    const balls = batting.balls !== null ? ` off ${plural(batting.balls, 'ball')}` : ''
    const boundaries = batting.fours !== null || batting.sixes !== null ? ` · ${batting.fours ?? DASH} fours, ${batting.sixes ?? DASH} sixes` : ''
    const how = batting.notOut ? 'not out' : howOutWords(batting.howOut as MyResultDismissal | null, batting.bowlerName)
    lines.push(`${score}${balls}${boundaries}${how ? ` · ${how}` : ''}${batting.strikeRate !== null ? ` · SR ${formatDecimal(batting.strikeRate, 1)}` : ''}`)
  }
  if (bowling) {
    lines.push(`${wicketsForRuns(bowling.wickets, bowling.runs)} in ${oversText(bowling.balls, bowling.ballsPerOver)} · economy ${formatDecimal(bowling.economy, 2)}${bowling.wides !== null ? ` · ${bowling.wides} wides` : ''}${bowling.noBalls !== null ? ` · ${bowling.noBalls} no-balls` : ''}`)
  }
  if (fielding) {
    lines.push(`${plural(fielding.catches, 'catch', 'catches')}, ${plural(fielding.runOuts, 'run-out')}, ${plural(fielding.stumpings, 'stumping')}`)
  }
  return lines
}

export function HubStatsDrill({ playerKey }: { playerKey: string }) {
  const [search] = useSearchParams()
  const kind = parseKind(search.get('kind'))
  const filter = search.get('filter')
  const scope = useMemo(() => scopeFromSearch(search), [search])
  const scopeQuery = statsScopeQuery(scope)
  const drill = useMyStatsInnings(playerKey, kind, filter, scope)
  const rows = useMemo(() => drill.data?.pages.flatMap((page) => page.rows) ?? [], [drill.data])
  const first = drill.data?.pages[0]

  const header = <HubPageHeader title={KIND_TITLE[kind]} context={first?.filterLabel ? <Typography noWrap sx={{ fontFamily: HUB.display, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 14, color: HUB.sand }}>{first.filterLabel}</Typography> : undefined} />

  let body
  if (drill.isError) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => void drill.refetch()}>Retry</Button>}>
        We could not load these innings. Please try again.
      </Alert>
    )
  } else if (drill.isLoading || !first) {
    body = (
      <Box sx={{ display: 'grid', gap: 1.5 }} aria-busy="true" data-testid="hub-stats-drill-loading">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} variant="rounded" height={96} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '22px' }} />
        ))}
      </Box>
    )
  } else if (rows.length === 0) {
    body = (
      <Box data-testid="hub-stats-drill-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>Nothing here yet</Typography>
        <Typography sx={{ fontSize: 15 }}>No matches in this scope match this figure.</Typography>
      </Box>
    )
  } else {
    body = (
      <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0, opacity: drill.isPlaceholderData ? 0.55 : 1 }}>
        <Typography data-testid="hub-stats-drill-count" sx={{ fontSize: 14, color: HUB.muted }}>
          {plural(first.page.totalElements, 'row')}
          {first.truncated ? ', from the newest matches only' : ''}. Tap a row to open that match.
        </Typography>
        <Box component="ul" data-testid="hub-stats-drill-list" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(310px, 1fr))' } }}>
          {rows.map((row, index) => (
            <Box component="li" key={`${row.matchId}-${index}`} sx={{ ...cardSx(resultTone(row.result)), p: '14px 16px', gap: 0.5 }}>
              <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600, m: 0 }}>
                <Box
                  component={RouterLink}
                  to={statsResultPath(playerKey, row.matchId, scopeQuery)}
                  aria-label={`${resultDate(row.matchDate)}${row.opponentName ? ` against ${row.opponentName}` : ''}. Open the match.`}
                  sx={stretchedLink}
                >
                  {resultDate(row.matchDate)}
                  {row.opponentName ? ` · ${row.opponentName}` : ''}
                </Box>
              </Typography>
              <Typography sx={{ fontSize: 13, color: HUB.muted }}>
                {row.ourTeamName} · {resultWord(row.result)}
              </Typography>
              {figuresOf(row).map((line, lineIndex) => (
                <Typography key={lineIndex} sx={{ fontSize: 15 }}>{line}</Typography>
              ))}
            </Box>
          ))}
        </Box>
        {drill.hasNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="secondary" size="compact" disabled={drill.isFetchingNextPage} onClick={() => void drill.fetchNextPage()} sx={{ ...hubOutlineButton, alignSelf: 'center' }}>
              {drill.isFetchingNextPage ? 'Loading...' : 'Show More'}
            </Button>
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box data-testid="hub-stats-drill" sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}>
      {header}
      {body}
    </Box>
  )
}
