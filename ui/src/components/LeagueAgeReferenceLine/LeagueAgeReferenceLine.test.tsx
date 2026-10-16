import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeagueAgeReferenceLine } from './LeagueAgeReferenceLine'

const mocks = vi.hoisted(() => ({ getLeagueAgeReference: vi.fn() }))
vi.mock('../../api/leagueApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/leagueApi')>()),
  getLeagueAgeReference: (...args: unknown[]) => mocks.getLeagueAgeReference(...args),
}))

function renderLine(hasAgeLimit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LeagueAgeReferenceLine clubId="club-1" leagueId="league-1" seasonId="season-1" hasAgeLimit={hasAgeLimit} />
    </QueryClientProvider>,
  )
}

describe('LeagueAgeReferenceLine', () => {
  beforeEach(() => {
    mocks.getLeagueAgeReference.mockReset()
  })

  it('says the cut-off date applies', async () => {
    mocks.getLeagueAgeReference.mockResolvedValue({
      referenceDate: '2026-12-31',
      source: 'CUTOFF',
      leagueStart: '2026-09-05',
      leagueStartSource: 'FIRST_MATCH',
    })
    renderLine()
    expect(await screen.findByTestId('league-age-reference')).toHaveTextContent('Ages are judged on 31 Dec 2026 (the cut-off)')
    expect(mocks.getLeagueAgeReference).toHaveBeenCalledWith('club-1', 'league-1', 'season-1')
  })

  it('says the league start day applies when there is no cut-off', async () => {
    mocks.getLeagueAgeReference.mockResolvedValue({
      referenceDate: '2027-07-14',
      source: 'LEAGUE_START',
      leagueStart: '2027-07-14',
      leagueStartSource: 'SEASON_START',
    })
    renderLine()
    expect(await screen.findByTestId('league-age-reference')).toHaveTextContent(
      'Ages are judged on 14 Jul 2027 (the day the league starts)',
    )
  })

  it('shows nothing while loading', () => {
    mocks.getLeagueAgeReference.mockReturnValue(new Promise(() => undefined))
    renderLine()
    expect(screen.queryByTestId('league-age-reference')).not.toBeInTheDocument()
  })

  it('shows nothing when the lookup fails', async () => {
    mocks.getLeagueAgeReference.mockRejectedValue(new Error('boom'))
    renderLine()
    await waitFor(() => expect(mocks.getLeagueAgeReference).toHaveBeenCalled())
    expect(screen.queryByTestId('league-age-reference')).not.toBeInTheDocument()
  })

  it('does not ask for a league without an age limit', () => {
    renderLine(false)
    expect(mocks.getLeagueAgeReference).not.toHaveBeenCalled()
    expect(screen.queryByTestId('league-age-reference')).not.toBeInTheDocument()
  })
})
