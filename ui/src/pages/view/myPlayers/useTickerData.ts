import { useMemo } from 'react'
import { useMyPlayerResults } from '../../../api/meResultsApi'
import type { MyResultScope } from '../../../api/meResultsApi'
import { useMyPlayerMatches, useMyPlayerPolls } from '../../../api/myPlayersApi'
import type { TickerContext } from './tickerTypes'
import { useNow } from './useNow'

// docs/specs/146 section 5: results are refetched at most every 5 minutes, polls every 2; the matches read keeps its own refresh (60
// seconds while a match is live). The ticker adds no query key and no refetch interval of its own.
const RESULTS_STALE_MS = 5 * 60_000
const POLLS_STALE_MS = 2 * 60_000
const DEFAULT_SCOPE: MyResultScope = {}

export interface TickerDataOptions {
  // False when the preference is off, on a route with no player, or on Watch Live: no request is made at all.
  enabled: boolean
  routeKey: string
}

// Calls the three existing Hub reads for the player in the route and returns the context the sources read (null when disabled).
// The time in it ticks once a minute, so countdowns and elapsed times stay right without a refetch.
export function useTickerData(playerKey: string | undefined, { enabled, routeKey }: TickerDataOptions): TickerContext | null {
  const key = enabled ? playerKey : undefined
  const matches = useMyPlayerMatches(key, { enabled })
  const polls = useMyPlayerPolls(key, { enabled, staleTime: POLLS_STALE_MS })
  const results = useMyPlayerResults(key, DEFAULT_SCOPE, enabled, RESULTS_STALE_MS)
  const now = useNow()

  const matchData = matches.data
  const pollData = polls.data
  const firstPage = results.data?.pages[0]
  return useMemo(
    () => (key ? { playerKey: key, firstName: null, now, routeKey, matches: matchData, polls: pollData, results: firstPage?.rows } : null),
    [key, now, routeKey, matchData, pollData, firstPage],
  )
}
