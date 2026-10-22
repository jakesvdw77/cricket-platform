import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import type { PlayerDashboard } from '../../../../api/playerDashboardApi'
import { emptyPlayerDashboard, makeBowlingMatch, makeInnings, makePlayerDashboard } from '../../../../test/dashboardFixtures'
import { RunsPerInningsCard } from './RunsPerInningsCard'
import { DismissalsCard } from './DismissalsCard'
import { BattingTrendCard } from './BattingTrendCard'
import { WicketsPerMatchCard } from './WicketsPerMatchCard'
import { WicketsByTypeCard } from './WicketsByTypeCard'
import { EconomyRateCard } from './EconomyRateCard'

// docs/specs/117-stats-dashboard.md (Test Plan, "Frontend component"): each of the six player cards, with the figures passed through as
// the server sent them. The fixtures' summary figures are deliberately not derivable from their points, so a client-side sum would show.
const BACK = '/manage/players/player-1/stats?tab=dashboard'
const draw = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)
const rows = (testId: string) => screen.getAllByTestId(`${testId}-row`).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))
const openTable = async (testId: string) => userEvent.click(screen.getByTestId(`${testId}-view-table`))
const headers = () => screen.getAllByRole('columnheader').map((cell) => cell.textContent)

describe('RunsPerInningsCard', () => {
  it('is the full-width Batting card; its table lists the innings in order with a * on a not-out and "Not recorded" for no runs', async () => {
    draw(<RunsPerInningsCard data={makePlayerDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Runs per innings, Batting' })).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-runs-per-innings')).toHaveAttribute('data-width', 'full')
    expect(screen.getByTestId('runs-per-innings-description')).toHaveTextContent('3 innings, 1 not out, 412 runs.')
    await openTable('runs-per-innings')
    expect(headers()).toEqual(['Date', 'Opponent', 'Runs', 'Balls', 'How out'])
    expect(rows('runs-per-innings')).toEqual([
      ['1 Mar 2026', 'Opponent 1', '10', '8', 'Caught'],
      ['2 Mar 2026', 'Opponent 2', '56*', '40', 'Not out'],
      ['3 Mar 2026', 'Opponent 3', 'Not recorded', '–', 'Bowled'],
    ])
  })

  it('shows the Total row as the server sent it (412), not the sum of the rows (66), when nothing is windowed', async () => {
    draw(<RunsPerInningsCard data={makePlayerDashboard()} backTo={BACK} dimmed={false} />)
    await openTable('runs-per-innings')
    expect(within(screen.getByTestId('runs-per-innings-total')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Total', '3 innings', '412', '', ''])
  })

  it('a windowed series has the caption naming the Runs tile and no Total row', async () => {
    const data = makePlayerDashboard({ truncated: true, battingSummary: { inningsTotal: 52, shown: 3, notOuts: 9, runs: 1500, averageRuns: 30 } })
    draw(<RunsPerInningsCard data={data} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('runs-per-innings-coverage')).toHaveTextContent('Last 3 of 52 innings; the Runs tile counts all 52.')
    await openTable('runs-per-innings')
    expect(screen.queryByTestId('runs-per-innings-total')).not.toBeInTheDocument()
  })

  it('names the matches with a batting card when only some have one', () => {
    const data = makePlayerDashboard({ basis: { matchesCounted: 14, resultsWithBattingCard: 12, resultsWithBowlingCard: 3 } })
    draw(<RunsPerInningsCard data={data} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('runs-per-innings-coverage')).toHaveTextContent('From 12 of 14 matches with a batting card.')
  })

  it('offers the average line as a switch only when the server sent an average, off by default, and adds it to the legend when on', async () => {
    const { unmount } = draw(<RunsPerInningsCard data={makePlayerDashboard()} backTo={BACK} dimmed={false} />)
    const toggle = screen.getByRole('checkbox', { name: /show average/i })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByText('Average 29.43')).not.toBeInTheDocument()
    await userEvent.click(toggle)
    expect(screen.getByText('Average 29.43')).toBeInTheDocument()
    unmount()
    draw(<RunsPerInningsCard data={makePlayerDashboard({ battingSummary: { inningsTotal: 3, shown: 3, notOuts: 1, runs: 412, averageRuns: null } })} backTo={BACK} dimmed={false} />)
    expect(screen.queryByRole('checkbox', { name: /show average/i })).not.toBeInTheDocument()
  })

  it('distinguishes "no scorecard captured" from "did not bat", with no table toggle', () => {
    const none = draw(<RunsPerInningsCard data={emptyPlayerDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('runs-per-innings-empty')).toHaveTextContent('No batting cards captured')
    expect(screen.queryByTestId('runs-per-innings-view-table')).not.toBeInTheDocument()
    none.unmount()
    draw(<RunsPerInningsCard data={{ ...emptyPlayerDashboard(), basis: { matchesCounted: 2, resultsWithBattingCard: 2, resultsWithBowlingCard: 0 } }} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('runs-per-innings-empty')).toHaveTextContent('No innings to show')
  })

  it('links each table date to the result page with the way back in router state, a derby in words', async () => {
    draw(<RunsPerInningsCard data={makePlayerDashboard({ battingInnings: [makeInnings(1, { derby: true, opponentName: null })] })} backTo={BACK} dimmed={false} />)
    await openTable('runs-per-innings')
    expect(screen.getByRole('link', { name: '1 Mar 2026' })).toHaveAttribute('href', '/manage/results/match-1')
    expect(rows('runs-per-innings')[0][1]).toBe('Internal match')
  })
})

describe('DismissalsCard', () => {
  it('is the half-width Batting card with the "Dismissals" column and the server\'s counts and shares', async () => {
    draw(<DismissalsCard data={makePlayerDashboard()} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'How you were dismissed, Batting' })).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-dismissals')).toHaveAttribute('data-width', 'half')
    // the donut centre carries the total, the legend a count and share per slice
    expect(screen.getByTestId('donut-legend')).toHaveTextContent('Caught5 · 35.7%')
    await openTable('dismissals')
    expect(headers()).toEqual(['How out', 'Dismissals', 'Share'])
    expect(rows('dismissals')).toEqual([['Caught', '5', '35.7%'], ['Bowled', '4', '28.6%'], ['Not out', '3', '21.4%']])
    expect(within(screen.getByTestId('dismissals-total')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Total innings', '3', ''])
  })

  it('has no Total row and says so when the window is truncated', async () => {
    draw(<DismissalsCard data={makePlayerDashboard({ truncated: true })} dimmed={false} />)
    expect(screen.getByTestId('dismissals-coverage')).toHaveTextContent('Covers the newest innings only; the Runs tile counts all.')
    await openTable('dismissals')
    expect(screen.queryByTestId('dismissals-total')).not.toBeInTheDocument()
  })

  it('shows its own message when there is nothing to chart, and no "How out" card title', () => {
    draw(<DismissalsCard data={emptyPlayerDashboard()} dimmed={false} />)
    expect(screen.getByTestId('dismissals-empty')).toHaveTextContent('No batting cards captured')
    expect(screen.getByRole('heading', { name: 'How you were dismissed' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'How out' })).not.toBeInTheDocument()
  })
})

describe('BattingTrendCard', () => {
  it('is the Batting card with Average | Runs; the table shows the server\'s running average (Not recorded before the first dismissal)', async () => {
    draw(<BattingTrendCard data={makePlayerDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Batting trend, Batting' })).toBeInTheDocument()
    expect(screen.getByTestId('batting-trend-note')).toHaveTextContent('Running average (runs per dismissal)')
    await openTable('batting-trend')
    expect(headers()).toEqual(['Innings', 'Date', 'Opponent', 'Average', 'Runs', 'Dismissals'])
    expect(rows('batting-trend')).toEqual([
      ['1', '1 Mar 2026', 'Opponent 1', 'Not recorded', '10', '0'],
      ['2', '2 Mar 2026', 'Opponent 2', '66.00', '66', '1'],
      ['3', '3 Mar 2026', 'Opponent 3', '29.43', '412', '2'],
    ])
  })

  it('the Average | Runs switch changes the note and the legend, never two scales at once', async () => {
    draw(<BattingTrendCard data={makePlayerDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByText('Overall average 29.43')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Runs' }))
    expect(screen.getByTestId('batting-trend-note')).toHaveTextContent('Cumulative runs')
    expect(screen.queryByText('Overall average 29.43')).not.toBeInTheDocument()
    expect(screen.getByText('Cumulative runs', { selector: 'li' })).toBeInTheDocument()
  })

  it('names the start of a truncated trend', () => {
    draw(<BattingTrendCard data={makePlayerDashboard({ truncated: true, truncatedSince: '2024-03-03T12:00:00Z' })} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('batting-trend-coverage')).toHaveTextContent('Since 3 Mar 2024.')
  })

  it('shows the empty message with no innings', () => {
    draw(<BattingTrendCard data={emptyPlayerDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('batting-trend-empty')).toHaveTextContent('No batting cards captured')
  })
})

describe('WicketsPerMatchCard', () => {
  it('is the full-width Bowling card; its table has overs through oversFormat and a Total equal to the server\'s wickets total', async () => {
    draw(<WicketsPerMatchCard data={makePlayerDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Wickets per match, Bowling' })).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-wickets-per-match')).toHaveAttribute('data-width', 'full')
    await openTable('wickets-per-match')
    expect(headers()).toEqual(['Date', 'Opponent', 'Overs', 'Maidens', 'Runs', 'Wickets'])
    expect(rows('wickets-per-match')).toEqual([
      ['1 Mar 2026', 'Opponent 1', '4.0', '1', '20', '1'],
      // a genuine 0-wicket, 0-ball spell stays a row with zeros the server sent
      ['2 Mar 2026', 'Opponent 2', '0.0', '1', '0', '0'],
      ['3 Mar 2026', 'Opponent 3', '3.4', '1', '17', '2'],
    ])
    // 5 is the server's wicket total (the fixture's rows add to 3): passed through, not summed
    expect(within(screen.getByTestId('wickets-per-match-total')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Total', '', '', '', '', '5'])
  })

  it('counts overs against the match\'s own balls per over', async () => {
    draw(<WicketsPerMatchCard data={makePlayerDashboard({ bowlingMatches: [makeBowlingMatch(1, { balls: 23, ballsPerOver: 5 })] })} backTo={BACK} dimmed={false} />)
    await openTable('wickets-per-match')
    expect(rows('wickets-per-match')[0][2]).toBe('4.3')
  })

  it('names a windowed series and drops the Total row', async () => {
    const data = makePlayerDashboard({ economySummary: { ...makePlayerDashboard().economySummary, totalPoints: 41, shown: 3 } })
    draw(<WicketsPerMatchCard data={data} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('wickets-per-match-coverage')).toHaveTextContent('Last 3 of 41 matches bowled; the Wickets tile counts all 41.')
    await openTable('wickets-per-match')
    expect(screen.queryByTestId('wickets-per-match-total')).not.toBeInTheDocument()
  })

  it('distinguishes no bowling card from not bowling', () => {
    const none = draw(<WicketsPerMatchCard data={emptyPlayerDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('wickets-per-match-empty')).toHaveTextContent('No bowling cards captured')
    none.unmount()
    draw(<WicketsPerMatchCard data={{ ...emptyPlayerDashboard(), basis: { matchesCounted: 2, resultsWithBattingCard: 0, resultsWithBowlingCard: 2 } }} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('wickets-per-match-empty')).toHaveTextContent('No bowling to show')
  })
})

describe('WicketsByTypeCard', () => {
  it('is the half-width Bowling card; the table has the three columns, the grey Not itemised row and a Total equal to the Wickets total', async () => {
    draw(<WicketsByTypeCard data={makePlayerDashboard()} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Wickets by type, Bowling' })).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-wickets-by-type')).toHaveAttribute('data-width', 'half')
    expect(screen.getByTestId('donut-legend')).toHaveTextContent('Not itemised1 · 20.0%')
    await openTable('wickets-by-type')
    expect(headers()).toEqual(['Dismissal type', 'Wickets', 'Share'])
    // a type with 0 wickets is left out; Not itemised is always a row
    expect(rows('wickets-by-type')).toEqual([['Bowled', '2', '40.0%'], ['LBW', '2', '40.0%'], ['Not itemised', '1', '20.0%']])
    expect(within(screen.getByTestId('wickets-by-type-total')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Total', '5', ''])
  })

  it('prints "N of M wickets itemised" when N < M, with the explanation, and nothing when equal', () => {
    const partly = draw(<WicketsByTypeCard data={makePlayerDashboard()} dimmed={false} />)
    expect(screen.getByTestId('wickets-by-type-coverage')).toHaveTextContent('4 of 5 wickets itemised.')
    expect(screen.getByTestId('wickets-by-type-footer')).toHaveTextContent('shown in grey')
    partly.unmount()
    const all = makePlayerDashboard().wicketTypes
    draw(<WicketsByTypeCard data={makePlayerDashboard({ wicketTypes: { ...all, itemised: 5, notItemised: { count: 0, percent: 0 }, coverage: { ...all.coverage, wicketsItemised: 5 } } })} dimmed={false} />)
    expect(screen.queryByTestId('wickets-by-type-coverage')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wickets-by-type-footer')).not.toBeInTheDocument()
  })

  it('the single-slice all-not-itemised state says the opposition cards do not name the bowler', async () => {
    const data = makePlayerDashboard({
      wicketTypes: { types: [], notItemised: { count: 3, percent: 100 }, total: 3, itemised: 0, coverage: { wicketsItemised: 0, wicketsTotal: 3, inningsItemised: 0, inningsWithWickets: 2 } },
    })
    draw(<WicketsByTypeCard data={data} dimmed={false} />)
    expect(screen.getByTestId('wickets-by-type-footer')).toHaveTextContent('do not name the bowler')
    expect(screen.getByTestId('wickets-by-type-coverage')).toHaveTextContent('0 of 3 wickets itemised.')
    expect(screen.getByTestId('donut-legend')).toHaveTextContent('Not itemised3 · 100.0%')
  })

  it('says "No wickets taken" for a bowler without wickets and "No bowling cards captured" without any card', () => {
    const noWickets = makePlayerDashboard({ wicketTypes: { ...emptyPlayerDashboard().wicketTypes } })
    const one = draw(<WicketsByTypeCard data={noWickets} dimmed={false} />)
    expect(screen.getByTestId('wickets-by-type-empty')).toHaveTextContent('No wickets taken')
    expect(screen.queryByTestId('wickets-by-type-view-table')).not.toBeInTheDocument()
    one.unmount()
    draw(<WicketsByTypeCard data={emptyPlayerDashboard()} dimmed={false} />)
    expect(screen.getByTestId('wickets-by-type-empty')).toHaveTextContent('No bowling cards captured')
  })
})

describe('EconomyRateCard', () => {
  const data = (over: Partial<PlayerDashboard> = {}) => makePlayerDashboard(over)

  it('is the Bowling card with "Lower is better", the reference value and the trend sentence from the server\'s fields', () => {
    draw(<EconomyRateCard data={data()} backTo={BACK} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Economy rate, Bowling' })).toBeInTheDocument()
    expect(screen.getByTestId('economy-rate-note')).toHaveTextContent('Lower is better')
    expect(screen.getByText('Overall 5.80')).toBeInTheDocument()
    expect(screen.getByTestId('economy-rate-description')).toHaveTextContent('Overall economy 5.80 runs per over over 3 matches.')
    expect(screen.getByTestId('economy-rate-footer')).toHaveTextContent('Last 5 matches: 5.10 runs per over, down from 6.00 in the 5 before.')
  })

  it('has no trend sentence when the server sent none (fewer than three matches in a half)', () => {
    draw(<EconomyRateCard data={data({ economySummary: { ...data().economySummary, recentEconomy: null, earlierEconomy: null, direction: null } })} backTo={BACK} dimmed={false} />)
    expect(screen.queryByTestId('economy-rate-footer')).not.toBeInTheDocument()
  })

  it('the table has the six columns, overs formatted, and "Not recorded" (never 0) where economy is undefined', async () => {
    draw(<EconomyRateCard data={data()} backTo={BACK} dimmed={false} />)
    await openTable('economy-rate')
    expect(headers()).toEqual(['Date', 'Opponent', 'Overs', 'Runs', 'Wickets', 'Econ'])
    expect(rows('economy-rate')).toEqual([
      ['1 Mar 2026', 'Opponent 1', '4.0', '20', '1', '5.10'],
      ['2 Mar 2026', 'Opponent 2', '0.0', '0', '0', 'Not recorded'],
      ['3 Mar 2026', 'Opponent 3', '3.4', '17', '2', '5.30'],
    ])
  })

  it('prints "Economy shown for N of M matches" when N < M and nothing when equal', () => {
    const partly = draw(<EconomyRateCard data={data()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('economy-rate-coverage')).toHaveTextContent('Economy shown for 2 of 3 matches.')
    partly.unmount()
    draw(<EconomyRateCard data={data({ economySummary: { ...data().economySummary, matchesWithEconomy: 3 } })} backTo={BACK} dimmed={false} />)
    expect(screen.queryByTestId('economy-rate-coverage')).not.toBeInTheDocument()
  })

  it('shows the no-balls message when no match has an economy, and the no-bowling messages', () => {
    const zero = draw(<EconomyRateCard data={data({ economySummary: { ...data().economySummary, matchesWithEconomy: 0, overallEconomy: null } })} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('economy-rate-empty')).toHaveTextContent('No economy rate for this player')
    zero.unmount()
    draw(<EconomyRateCard data={emptyPlayerDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('economy-rate-empty')).toHaveTextContent('No bowling cards captured')
  })

  it('draws no reference label or legend entry when the server has no overall economy', () => {
    draw(<EconomyRateCard data={data({ economySummary: { ...data().economySummary, overallEconomy: null } })} backTo={BACK} dimmed={false} />)
    expect(screen.queryByText(/^Overall /)).not.toBeInTheDocument()
  })
})
