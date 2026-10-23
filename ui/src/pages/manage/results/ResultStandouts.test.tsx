import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Team } from '../../../api/teamApi'
import type { Scorecard } from '../../../api/matchResultApi'
import { baseTheme } from '../../../theme'
import { ResultBody } from './ResultBody'
import { makeMatch, makeResult } from './resultTestUtils'

// docs/specs/118 owner item 20: the Standouts (star chips and the team's player of the match) are the last block of the Details card,
// full width below the rows, shared by the Result page and the wizard's Preview result dialog (both render ResultBody).

const getScorecard = vi.fn()
vi.mock('../../../api/matchResultApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchResultApi')>()
  return { ...actual, getScorecard: (c: string, m: string) => getScorecard(c, m) }
})

const team = (id: string, name: string) => [id, { id, name, logoUrl: null }] as const
const ONE = new Map<string, Team>([team('team-1', '1st XI')] as never)
const BOTH = new Map<string, Team>([team('team-1', '1st XI'), team('team-2', '2nd XI')] as never)

const reg = (id: string, first: string, last: string, side: 'HOME' | 'AWAY' = 'HOME') => ({
  id, side, playerProfileId: `p-${id}`, displayName: null, plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false, firstName: first, lastName: last, guest: false,
})
const scorecard = (patch: Partial<Scorecard> = {}): Scorecard => ({
  players: [reg('a', 'Ann', 'Ash'), reg('b', 'Bob', 'Bell')] as never,
  batting: [
    { battingSide: 'HOME', inningsKind: 'REGULAR', resultPlayerId: 'a', position: 1, howOut: 'BOWLED', runs: 72, balls: 40, fours: 5, sixes: 1, featuredOverride: null, suggested: true, featured: true },
  ] as never,
  bowling: [], fielding: [],
  awards: [{ awardType: 'TEAM_PLAYER_OF_MATCH', side: 'HOME', resultPlayerId: 'b' }] as never,
  ...patch,
})

function renderBody({ teams = ONE, match = makeMatch({ id: 'match-1' }), hasScorecard = true }: { teams?: Map<string, Team>; match?: ReturnType<typeof makeMatch>; hasScorecard?: boolean } = {}) {
  render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ResultBody clubId="club-1" match={match} result={makeResult({ hasScorecard, detailLevel: hasScorecard ? 'FULL' : 'SUMMARY' })} teamsById={teams} readOnly />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  getScorecard.mockResolvedValue(scorecard())
})

describe('ResultStandouts', () => {
  it('is the last block of the Details card, below the rows, with a Standouts label and the star chips', async () => {
    renderBody()
    const block = await screen.findByTestId('result-standouts')
    const details = screen.getByTestId('result-details')
    expect(details).toContainElement(block)
    expect(details.lastElementChild).toBe(block)
    expect(within(block).getByText('Standouts')).toBeInTheDocument()
    expect(within(block).getByTestId('scorecard-standouts')).toHaveTextContent('Ann Ash 72 (40)')
    // It sits in the Details card, which comes before the Innings card.
    expect(details.closest('section')).toContainElement(block)
  })

  it('is no longer inside either team\'s scorecard section', async () => {
    renderBody()
    await screen.findByTestId('result-standouts')
    const home = await screen.findByTestId('scorecard-home')
    expect(within(home).queryByTestId('scorecard-standouts')).not.toBeInTheDocument()
    expect(within(home).queryByTestId('scorecard-team-award')).not.toBeInTheDocument()
    expect(within(home).queryByText('Standouts')).not.toBeInTheDocument()
  })

  it('shows the team player of the match without a team suffix when only one side is ours', async () => {
    renderBody()
    expect(await screen.findByTestId('scorecard-team-award')).toHaveTextContent('Team player of the match: Bob Bell')
  })

  it('suffixes the team name on the team award in a derby (both sides ours)', async () => {
    getScorecard.mockResolvedValue(
      scorecard({
        players: [reg('a', 'Ann', 'Ash'), reg('b', 'Bob', 'Bell'), reg('c', 'Cy', 'Cox', 'AWAY')] as never,
        awards: [
          { awardType: 'TEAM_PLAYER_OF_MATCH', side: 'HOME', resultPlayerId: 'b' },
          { awardType: 'TEAM_PLAYER_OF_MATCH', side: 'AWAY', resultPlayerId: 'c' },
        ] as never,
      }),
    )
    renderBody({ teams: BOTH, match: makeMatch({ id: 'match-1', awayTeamId: 'team-2', awayTeamName: null }) })
    const awards = await screen.findAllByTestId('scorecard-team-award')
    expect(awards.map((award) => award.textContent)).toEqual(['Team player of the match (1st XI): Bob Bell', 'Team player of the match (2nd XI): Cy Cox'])
  })

  it('is left out when there is nothing to show (no empty block, no Not recorded row)', async () => {
    getScorecard.mockResolvedValue(scorecard({ batting: [], awards: [] }))
    renderBody()
    await screen.findByTestId('scorecard-home')
    expect(screen.queryByTestId('result-standouts')).not.toBeInTheDocument()
    expect(screen.queryByText('Standouts')).not.toBeInTheDocument()
  })

  it('is left out for a summary-only result', async () => {
    renderBody({ hasScorecard: false })
    await screen.findByTestId('result-details')
    expect(getScorecard).not.toHaveBeenCalled()
    expect(screen.queryByTestId('result-standouts')).not.toBeInTheDocument()
  })

  it('shows nothing for the opposition (only our sides have standouts)', async () => {
    getScorecard.mockResolvedValue(
      scorecard({
        players: [{ ...reg('x', 'Sam', 'Jones', 'AWAY'), playerProfileId: null }] as never,
        batting: [{ battingSide: 'AWAY', inningsKind: 'REGULAR', resultPlayerId: 'x', position: 1, howOut: 'BOWLED', runs: 99, balls: 50, fours: 0, sixes: 0, featuredOverride: null, suggested: true, featured: true }] as never,
        awards: [],
      }),
    )
    renderBody()
    await screen.findByTestId('result-details')
    await screen.findByTestId('scorecard-away')
    expect(screen.queryByTestId('result-standouts')).not.toBeInTheDocument()
  })
})
