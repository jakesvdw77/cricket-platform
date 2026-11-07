import { Route } from 'react-router-dom'
import type { ReactElement } from 'react'
import type { MyResultFilters } from '../api/meResultsApi'
import { makeMyPlayer } from './myPlayerFixtures'
import { makeResultFilters } from './statsFixtures'
import { renderRoutes, routeApi } from './accountTestUtils'
import type { ApiMock } from './accountTestUtils'

// The Player Hub stats pages talk to the real api hooks; a test mocks the one axiosConfig module and routes by "METHOD url". These helpers
// render a page at /stats (the page takes the player key as a prop) with the shared routes already in place.
export const filtersWithOneChoice = (over: Partial<MyResultFilters> = {}): MyResultFilters =>
  makeResultFilters({
    seasons: [{ id: 's1', name: '2025/26' }],
    teams: [{ id: 't1', name: 'U14 A' }],
    combos: [{ seasonId: 's1', leagueId: 'l1', teamId: 't1' }],
    ...over,
  })

export function renderStatsPage(http: ApiMock, page: ReactElement, routes: Record<string, unknown>, entry = '/stats') {
  routeApi(http, { 'GET /me/players/k1': makeMyPlayer(), ...routes })
  return renderRoutes(entry, <Route path="/stats" element={page} />)
}
