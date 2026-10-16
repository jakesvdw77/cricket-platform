import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BattingEntry, Scorecard } from '../../../api/matchResultApi'
import { baseTheme } from '../../../theme'
import { ResultScorecard } from './ResultScorecard'
import { makeMatch, makeResult } from './resultTestUtils'

const getScorecard = vi.fn()
const linkResultPlayer = vi.fn()

vi.mock('../../../api/matchResultApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchResultApi')>()
  return {
    ...actual,
    getScorecard: (c: string, m: string) => getScorecard(c, m),
    linkResultPlayer: (...args: unknown[]) => linkResultPlayer(...args),
  }
})
// The picker has its own tests; here it only stands in for "choose a registered player".
vi.mock('../../../components/PlayerSlotPicker', () => ({
  PlayerSlotPicker: ({ open, onPickPlayer }: { open: boolean; onPickPlayer: (p: { playerProfileId: string; firstName: string; lastName: string }) => void }) =>
    open ? <button onClick={() => onPickPlayer({ playerProfileId: 'p-zoe', firstName: 'Zoe', lastName: 'Zane' })}>Pick Zoe Zane</button> : null,
}))

const reg = (id: string, first: string, last: string, side = 'HOME') => ({
  id, side, playerProfileId: `p-${id}`, displayName: null, plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false, firstName: first, lastName: last, guest: false,
})
const opp = (id: string, name: string) => ({
  id, side: 'AWAY', playerProfileId: null, displayName: name, plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false, opposition: true,
})
const bat = (battingSide: 'HOME' | 'AWAY', playerId: string, patch: object): BattingEntry => ({
  battingSide, inningsKind: 'REGULAR', resultPlayerId: playerId, position: 1, howOut: 'NOT_OUT', runs: 0, balls: 0, fours: 0, sixes: 0, featuredOverride: null, ...patch,
} as BattingEntry)

const card = (): Scorecard => ({
  players: [reg('a', 'Ann', 'Ash'), { ...reg('g', '', '', 'HOME'), playerProfileId: null, displayName: 'Gus Guest', firstName: null, lastName: null, guest: true }, opp('x', 'Sam Jones'), opp('y', 'Tom Brown')] as never,
  batting: [
    bat('HOME', 'a', { position: 1, howOut: 'CAUGHT', runs: 50, balls: 40, fours: 5, sixes: 1, fielderPlayerId: 'x', bowlerPlayerId: 'y' }),
    bat('HOME', 'g', { position: 2, howOut: 'NOT_OUT', runs: 12, balls: 10 }),
    bat('AWAY', 'x', { position: 1, howOut: 'BOWLED', runs: 20, balls: 18, bowlerPlayerId: 'a' }),
  ],
  bowling: [
    { battingSide: 'AWAY', inningsKind: 'REGULAR', resultPlayerId: 'a', bowlingOrder: 1, balls: 24, maidens: 1, runs: 30, wickets: 1, wides: 2, noBalls: 0, featuredOverride: null },
    { battingSide: 'HOME', inningsKind: 'REGULAR', resultPlayerId: 'y', bowlingOrder: 1, balls: 24, maidens: 0, runs: 40, wickets: 1, wides: 0, noBalls: 0, featuredOverride: null },
  ],
  fielding: [{ battingSide: 'HOME', inningsKind: 'REGULAR', resultPlayerId: 'x', catches: 1, stumpings: 0, runOuts: 0, featuredOverride: null }],
  awards: [{ awardType: 'PLAYER_OF_MATCH', side: null, resultPlayerId: 'a' }],
  innings: [],
})

function renderCard(status: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED', ours = { home: true, away: false }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = makeResult({ status, hasScorecard: true, detailLevel: 'FULL' })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <ResultScorecard clubId="club-1" match={makeMatch({ id: 'match-1' })} result={result} names={{ home: '1st XI', away: 'Riverside Occasionals' }} ours={ours} toss={null} />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  getScorecard.mockResolvedValue(card())
  linkResultPlayer.mockResolvedValue(undefined)
})

describe('ResultScorecard', () => {
  it('never shows a planned batting number under a name, even when it differs from where the player batted', async () => {
    getScorecard.mockResolvedValue({ ...card(), players: [{ ...reg('a', 'Ann', 'Ash'), plannedBattingOrder: 7 }, ...card().players.slice(1)] })
    renderCard()
    await screen.findAllByText('Ann Ash')
    expect(screen.queryByText(/planned/i)).not.toBeInTheDocument()
  })

  it('shows a section per side with its batting table, the dismissal text and the names of the other side', async () => {
    renderCard()
    const home = await screen.findByTestId('scorecard-home')
    const away = screen.getByTestId('scorecard-away')
    expect(within(home).getAllByText('Ann Ash').length).toBeGreaterThan(0)
    expect(within(home).getByText('c Sam Jones b Tom Brown')).toBeInTheDocument()
    expect(within(home).getByText('not out')).toBeInTheDocument()
    expect(within(away).getByText('Sam Jones')).toBeInTheDocument()
    expect(within(away).getByText('b Ann Ash')).toBeInTheDocument()
  })

  it('shows bowling figures with the economy and the fielding credits', async () => {
    renderCard()
    const home = await screen.findByTestId('scorecard-home')
    const bowlingTable = within(home).getAllByRole('table').find((table) => table.getAttribute('aria-label')?.toLowerCase().includes('bowling'))
    expect(bowlingTable).toBeDefined()
    expect(within(bowlingTable as HTMLElement).getByText('Ann Ash')).toBeInTheDocument()
    expect(within(bowlingTable as HTMLElement).getByText('7.50')).toBeInTheDocument()
    expect(screen.getByTestId('scorecard-away')).toHaveTextContent('Sam Jones: 1 catch')
  })

  it('switches every name to the first name, tagging only collisions, from the Full name | First name toggle', async () => {
    const user = userEvent.setup()
    renderCard()
    const home = await screen.findByTestId('scorecard-home')
    await user.click(screen.getAllByRole('button', { name: /first name/i })[0])
    await waitFor(() => expect(within(home).getAllByText('Ann').length).toBeGreaterThan(0))
    expect(within(home).queryByText('Ann Ash')).not.toBeInTheDocument()
  })

  it('offers Link to player on a guest of our side, even on a published result, and never on the opposition', async () => {
    const user = userEvent.setup()
    renderCard('PUBLISHED')
    const home = await screen.findByTestId('scorecard-home')
    const links = within(home).getAllByRole('button', { name: /link to player/i })
    expect(links.length).toBeGreaterThan(0)
    expect(within(screen.getByTestId('scorecard-away')).queryByRole('button', { name: /link to player/i })).not.toBeInTheDocument()

    await user.click(links[0])
    await user.click(await screen.findByRole('button', { name: 'Pick Zoe Zane' }))
    await waitFor(() => expect(linkResultPlayer).toHaveBeenCalled())
    expect(linkResultPlayer.mock.calls[0].slice(0, 4)).toEqual(['club-1', 'match-1', 'g', 'p-zoe'])
  })

  it('has no Link to player when nobody is a guest', async () => {
    getScorecard.mockResolvedValue({ ...card(), players: card().players.filter((p) => !(p as { guest?: boolean }).guest), batting: card().batting.filter((e) => e.resultPlayerId !== 'g') })
    renderCard()
    await screen.findByTestId('scorecard-home')
    expect(screen.queryByRole('button', { name: /link to player/i })).not.toBeInTheDocument()
  })

  it('says so when the scorecard cannot be loaded', async () => {
    getScorecard.mockRejectedValue(new Error('boom'))
    renderCard()
    expect(await screen.findByText(/couldn't load the scorecard/i)).toBeInTheDocument()
  })
})
