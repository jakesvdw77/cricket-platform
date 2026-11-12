import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { CardCtx, CardScope, StatsCardDef } from '../../../../components/StatsCards'
import { STATS_COLOUR } from '../../../../brandTokens'
import { makeMyStats, makeMyTeamStats, makeStanding } from '../../../../test/statsFixtures'
import { allCards } from './statsCardRegistry'
import { batterDismissalColour } from './dismissalColours'

// docs/specs/147 Test Plan, Component: each card family renders from a fixture, from both faces, with its links. A card's pure state()
// is exercised through the registry; here the Front and Back are drawn directly so a face problem names the card.
const scope = (over: Partial<CardScope> = {}): CardScope => ({ activeLeagueId: null, activeTeamId: null, filterLeague: vi.fn(), filterTeam: vi.fn(), ...over })
const ctxOf = (over: Partial<CardCtx> = {}): CardCtx => ({
  firstName: 'Sam',
  teamName: 'U14 A',
  scopeLabel: '2025/26',
  resultHref: (id) => `/results/${id}?origin=stats`,
  drillHref: (target) => `/drill/${target.kind}/${target.filter ?? ''}`,
  ...over,
})

function def<P>(id: string): StatsCardDef<P> {
  const found = allCards().find((card) => card.id === id)
  if (!found) throw new Error(`no card ${id}`)
  return found as unknown as StatsCardDef<P>
}

function faces<P>(id: string, payload: P, ctx: CardCtx = ctxOf()) {
  const card = def<P>(id)
  const state = card.state(payload, ctx)
  const props = { payload, ctx, state }
  return render(
    <MemoryRouter>
      <section data-testid="front"><card.Front {...props} /></section>
      <section data-testid="back"><card.Back {...props} /></section>
    </MemoryRouter>,
  )
}
const front = () => within(screen.getByTestId('front'))
const back = () => within(screen.getByTestId('back'))

describe('My stats cards', () => {
  it('Season in a card: the runs figure, the splits, the tiles and the last scores, each opening its match', () => {
    faces('mine.season', makeMyStats())
    expect(front().getByTestId('stats-big')).toHaveTextContent('158')
    expect(front().getByText('Home')).toBeInTheDocument()
    expect(front().getByTestId('stats-season-line')).toHaveTextContent('SR 83.2 · HS 63')
    expect(front().getByRole('link', { name: /^31, 6 Nov\. Open the match/ })).toHaveAttribute('href', '/results/m6?origin=stats')
    expect(back().getAllByText(/Last 5 average 28.0, up from 22.0 earlier/).length).toBeGreaterThan(0)
  })

  it('Innings by innings: a dot per innings with the number, the not out starred, the guides at the server values, and a table on the back', () => {
    faces('mine.innings', makeMyStats())
    expect(front().getAllByTestId('line-value').map((text) => text.textContent)).toEqual(['12', '47*', '5', '63', '0', '31'])
    expect(front().getAllByTestId('line-guide').map((guide) => guide.textContent)).toEqual(['30', '50'])
    expect(front().getByRole('link', { name: /47 not out against Rovers 2/ })).toHaveAttribute('href', '/results/m2?origin=stats')
    const table = back().getByRole('table', { name: 'Runs in each innings' })
    expect(within(table).getAllByRole('row')).toHaveLength(7)
    expect(within(table).getByRole('link', { name: /Open the match of 2 Nov/ })).toBeInTheDocument()
  })

  it('How Sam gets out: slices in the dismissal colours, a slice opening its drill, and the bowlers on the back', () => {
    faces('mine.dismissals', makeMyStats())
    const slices = front().getAllByTestId('donut-slice')
    expect(slices).toHaveLength(4)
    const fills = slices.map((slice) => (slice.querySelector('path') ?? slice).getAttribute('fill'))
    expect(fills).toEqual(['BOWLED', 'CAUGHT', 'LBW', 'NOT_OUT'].map(batterDismissalColour))
    expect(fills[3]).toBe(STATS_COLOUR.good)
    expect(front().getByRole('link', { name: 'Bowled: 2' })).toHaveAttribute('href', '/drill/BATTING/BOWLED')
    expect(front().getByRole('link', { name: 'Not out: 1' })).toHaveAttribute('href', '/drill/BATTING/NOT_OUT')
    expect(back().getByText('Alex Rao').closest('tr')).toHaveTextContent('2')
    expect(back().getByText('Not recorded').closest('tr')).toHaveTextContent('2')
  })

  it('Batting position: bars of runs with the opener first, and every figure in the back table', () => {
    faces('mine.positions', makeMyStats())
    expect(front().getAllByTestId('bar-row').map((row) => row.textContent)).toEqual(['Opener80', 'No. 363', 'No. 415'])
    expect(back().getAllByRole('row')).toHaveLength(4)
  })

  it('Batting position: shows at most four bars, the four with the most runs in batting order', () => {
    const groups = [1, 2, 3, 4, 5, 6].map((n) => ({ key: String(n), label: String(n), innings: 1, runs: n === 2 ? 1 : n * 10, notOuts: 0, dismissals: 1, average: 10, highest: n * 10 }))
    faces('mine.positions', makeMyStats({ battingPositionGroups: groups, batting: { ...makeMyStats().batting, innings: 6 } }))
    expect(front().getAllByTestId('bar-row').map((row) => row.textContent)).toEqual(['No. 330', 'No. 440', 'No. 550', 'No. 660'])
    expect(front().getByText(/Top 4 of 6 positions by runs/)).toBeInTheDocument()
  })

  describe('Next milestone colours', () => {
    const milestones = (runs: number, wickets: number) => ({ ...makeMyStats().milestones, runs: { current: runs, target: 250, toGo: 250 - runs }, wickets: { current: wickets, target: 10, toGo: 10 - wickets } })
    const textColour = (text: string) => getComputedStyle(front().getByText(text)).color
    const probe = (colour: string) => {
      const el = document.createElement('i')
      el.style.color = colour
      return el.style.color
    }

    it('is grey below half way, amber from half way, and green from four fifths', () => {
      faces('mine.milestone', makeMyStats({ milestones: milestones(100, 9) }))
      expect(textColour('150 to go')).toBe(probe(STATS_COLOUR.neutralGrey))
      expect(textColour('1 to go')).toBe(probe(STATS_COLOUR.good))
    })

    it('is amber exactly at half way and green exactly at four fifths', () => {
      faces('mine.milestone', makeMyStats({ milestones: milestones(125, 8) }))
      expect(textColour('125 to go')).toBe(probe(STATS_COLOUR.amber))
      expect(textColour('2 to go')).toBe(probe(STATS_COLOUR.good))
    })

    it('shows a reached milestone as Done in gold', () => {
      faces('mine.milestone', makeMyStats({ milestones: milestones(250, 3) }))
      expect(front().getByText('Done')).toBeInTheDocument()
      expect(screen.queryByText('0 to go')).not.toBeInTheDocument()
    })

    it('lists the personal bests on the back, each opening its match', () => {
      faces('mine.milestone', makeMyStats())
      expect(back().getByRole('link', { name: 'Open the match of the highest score' })).toHaveAttribute('href', '/results/m4?origin=stats')
      expect(back().getByText('Best bowling').closest('tr')).toHaveTextContent('3/18')
    })
  })

  describe('Summary cards', () => {
    it('Matches Played: one season is one quiet line, no bar and nothing to choose', () => {
      const one = makeMyStats({ bySeason: [makeMyStats().bySeason[1]] })
      faces('mine.sum-matches', one)
      expect(front().getByTestId('stats-single-item')).toHaveTextContent('2025/26 · 7 matches')
      expect(front().queryByTestId('horizontal-bars')).not.toBeInTheDocument()
      expect(front().getByTestId('stats-big')).toHaveTextContent('7')
    })

    it('Matches Played: several seasons are bars, the newest first, with the table on the back', () => {
      faces('mine.sum-matches', makeMyStats())
      expect(front().queryByTestId('stats-single-item')).not.toBeInTheDocument()
      expect(front().getAllByTestId('bar-row').map((row) => row.textContent)).toEqual(['2025/26' + '7', '2024/25' + '9'])
      expect(back().getAllByRole('row')).toHaveLength(3)
    })

    it('Leagues Played: a bar filters the page to that league, and the active one clears again', async () => {
      const user = userEvent.setup()
      const league = scope()
      faces('mine.sum-leagues', makeMyStats(), ctxOf({ scope: league }))
      await user.click(front().getByRole('button', { name: 'Filter to Premier League' }))
      expect(league.filterLeague).toHaveBeenCalledWith('l1')
    })

    it('Leagues Played: marks the active league pressed, offers to clear it, and clearing sends null', async () => {
      const user = userEvent.setup()
      const league = scope({ activeLeagueId: 'l1' })
      faces('mine.sum-leagues', makeMyStats(), ctxOf({ scope: league }))
      expect(front().getByRole('button', { name: 'Clear Premier League filter' })).toHaveAttribute('aria-pressed', 'true')
      await user.click(front().getByRole('button', { name: 'Show all leagues' }))
      expect(league.filterLeague).toHaveBeenCalledWith(null)
    })

    it('Leagues Played: without a page scope the bars are plain, not buttons', () => {
      faces('mine.sum-leagues', makeMyStats())
      expect(front().queryByRole('button')).not.toBeInTheDocument()
      expect(front().getAllByTestId('bar-row')).toHaveLength(2)
    })
  })

  it('every My stats card draws both faces from the full fixture without the quiet missing text', () => {
    for (const card of allCards().filter((entry) => entry.page === 'mine' && !entry.hidden)) {
      const { unmount } = faces(card.id, makeMyStats())
      expect(screen.getByTestId('front'), card.id).not.toBeEmptyDOMElement()
      expect(screen.getByTestId('back'), card.id).not.toBeEmptyDOMElement()
      expect(document.body.textContent, card.id).not.toMatch(/\byou(r)?\b/i)
      unmount()
    }
  })
})

describe('Team stats cards', () => {
  it('Totals By Match: a column per match, green for a win, coral for a loss and the neutral bar otherwise, each opening its match', () => {
    faces('team.totals-by-match', makeMyTeamStats())
    const bars = front().getAllByTestId('column-bar')
    expect(bars).toHaveLength(5)
    expect(bars[0]).toHaveStyle({ backgroundColor: STATS_COLOUR.good })
    expect(bars[1]).toHaveStyle({ backgroundColor: STATS_COLOUR.bad })
    expect(bars[3]).toHaveStyle({ backgroundColor: STATS_COLOUR.bar })
    expect(front().getByRole('link', { name: /180 runs, won against Rovers 1, 1 Nov\. Open the match\./ })).toHaveAttribute('href', '/results/m1?origin=stats')
    expect(back().getAllByRole('row')).toHaveLength(6)
  })

  it('How the team gets out: slices in the dismissal colours, the not outs, and the shares on the back', () => {
    faces('team.dismissals', makeMyTeamStats())
    expect(front().getByText('2 batters finished not out.')).toBeInTheDocument()
    const fills = front().getAllByTestId('donut-slice').map((slice) => (slice.querySelector('path') ?? slice).getAttribute('fill'))
    expect(fills).toEqual([batterDismissalColour('BOWLED'), batterDismissalColour('CAUGHT')])
    expect(back().getByText('Not out').closest('tr')).toHaveTextContent('2')
  })

  it('Catches By Fielder: bars of catches for the top fielders, and the full fielding table on the back', () => {
    faces('team.catches-by-fielder', makeMyTeamStats())
    expect(front().getAllByTestId('bar-row').map((row) => row.textContent)).toEqual(['Lee Fox5', 'Sam Naidoo4'])
    const table = back().getByRole('table', { name: /Catches, stumpings and run-outs by fielder/ })
    expect(within(table).getByText('Lee Fox').closest('tr')).toHaveTextContent('6')
    expect(back().getByText(/5 more dismissals came from the rest of the squad/)).toBeInTheDocument()
  })

  it('every Team stats card draws both faces from the full fixture with no "you" in its copy', () => {
    for (const card of allCards().filter((entry) => entry.page === 'team' && !entry.hidden)) {
      const { unmount } = faces(card.id, makeMyTeamStats())
      expect(screen.getByTestId('front'), card.id).not.toBeEmptyDOMElement()
      expect(screen.getByTestId('back'), card.id).not.toBeEmptyDOMElement()
      expect(document.body.textContent, card.id).not.toMatch(/\byou(r)?\b/i)
      unmount()
    }
  })
})

describe('Where Sam stands', () => {
  it('shows a tile for each of the eight lines with the ordinal place and "of N players", and a dash where there is no rank', () => {
    faces('boards.standing', makeStanding())
    const tiles = front().getAllByRole('listitem')
    expect(tiles).toHaveLength(8)
    expect(front().getByLabelText('Runs: 3rd, of 14')).toBeInTheDocument()
    expect(front().getByLabelText('Economy: –, Below minimum')).toBeInTheDocument()
    expect(front().getByTestId('standing-playerOfTheMatch')).toHaveTextContent('POTM awards')
    expect(front().getByTestId('standing-playerOfTheMatch')).toHaveTextContent('2nd')
  })

  it('writes the rank, players and sample of each line in a table on the back, with the minimum note and no other player named', () => {
    faces('boards.standing', makeStanding())
    const table = back().getByRole('table', { name: /Sam's rank in each figure/ })
    expect(within(table).getAllByRole('row')).toHaveLength(9)
    expect(within(table).getByText(/^Runs 158$/).closest('tr')).toHaveTextContent('3rd')
    expect(back().getByText(/To be ranked, batting average needs 3 innings/)).toBeInTheDocument()
    expect(back().getByText(/14 players are in this list in all/)).toBeInTheDocument()
  })

  it('is partial when some line has no rank, empty when none has, and missing when the server sent no lines', () => {
    const card = def<ReturnType<typeof makeStanding>>('boards.standing')
    const ctx = ctxOf()
    expect(card.state(makeStanding(), ctx)).toBe('partial')
    expect(card.state(makeStanding({ lines: makeStanding().lines.filter((line) => line.rank !== null) }), ctx)).toBe('ready')
    expect(card.state(makeStanding({ lines: [] }), ctx)).toBe('missing')
    expect(card.state(makeStanding({ lines: makeStanding().lines.map((line) => ({ ...line, rank: null, belowMinimum: false })) }), ctx)).toBe('empty')
  })
})
