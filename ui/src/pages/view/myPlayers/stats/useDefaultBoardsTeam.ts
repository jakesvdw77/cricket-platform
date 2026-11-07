import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMyPlayerResults } from '../../../../api/meResultsApi'
import type { MyResultFilters } from '../../../../api/meResultsApi'
import type { HubScope } from '../HubScopeControls'

// docs/specs/147 section 6: the Leaderboards page opens on the current season and the player's current team (as Team stats does), but
// All Teams stays a choice. So the default is applied ONCE per visit by writing the team to the address (never again, or All Teams could
// not be chosen), and only when the address and the saved scope name no team. The current team is the team of the player's newest result in
// the scope, else the only team (or the first) the player has results for. Returns true while the default is still being worked out, so the
// page does not ask the server for a table it is about to replace.
function teamsOf(filters: MyResultFilters, controls: HubScope): { id: string }[] {
  const combos = filters.combos.filter((combo) => (!controls.scope.seasonId || combo.seasonId === controls.scope.seasonId) && (!controls.scope.leagueId || combo.leagueId === controls.scope.leagueId))
  return filters.teams.filter((team) => combos.some((combo) => combo.teamId === team.id))
}

export function useDefaultBoardsTeam(playerKey: string, controls: HubScope, ownFilters: MyResultFilters | undefined, reachTeamIds: string[] | undefined): boolean {
  const [, setSearch] = useSearchParams()
  const [done, setDone] = useState(false)
  const ready = Boolean(ownFilters && reachTeamIds)
  const explicit = Boolean(controls.teamId)
  const options = ownFilters ? teamsOf(ownFilters, controls).filter((team) => reachTeamIds?.includes(team.id)) : []
  const waiting = ready && !done && !explicit && options.length > 0
  const latest = useMyPlayerResults(playerKey, { seasonId: controls.scope.seasonId, leagueId: controls.scope.leagueId }, waiting && options.length > 1)

  let target = ''
  if (waiting) {
    if (options.length === 1) target = options[0].id
    else if (!latest.isLoading) {
      const newest = latest.data?.pages[0]?.rows[0]
      target = newest?.ourTeams.map((team) => team.teamId).find((id) => Boolean(id) && options.some((option) => option.id === id)) ?? options[0].id
    }
  }

  useEffect(() => {
    if (!ready || done) return
    if (explicit || options.length === 0) {
      setDone(true)
      return
    }
    if (!target) return
    setSearch(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('team', target)
        return next
      },
      { replace: true },
    )
    setDone(true)
    // `options` is derived from the two payloads; the three values below decide everything.
  }, [ready, done, explicit, options.length, target, setSearch])

  return !ready || waiting
}
