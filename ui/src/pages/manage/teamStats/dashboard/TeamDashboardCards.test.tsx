import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { makeDotsPoint, makeExtrasPoint, makeTeamDashboard, makeTeamResult } from '../../../../test/dashboardFixtures'
import { ResultsCard } from './ResultsCard'
import { RunsScoredCard } from './RunsScoredCard'
import { RunRateTrendCard } from './RunRateTrendCard'
import { ExtrasConcededCard } from './ExtrasConcededCard'
import { DotBallsCard } from './DotBallsCard'
import { resultMarkers } from './teamDashboardParts'

// docs/specs/117-stats-dashboard.md (Test Plan, "Frontend component", Team page): the five team cards, figures passed through as the
// server sent them. The fixtures' summary figures are deliberately not derivable from their points.
const BACK = '/manage/teams/team-1/stats'
const draw = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)
const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent)
const rows = (testId: string) => screen.getAllByTestId(`${testId}-row`).map(cells)
const openTable = async (testId: string) => userEvent.click(screen.getByTestId(`${testId}-view-table`))
const headers = () => screen.getAllByRole('columnheader').map((cell) => cell.textContent)

describe('resultMarkers', () => {
  it('words the derby and forfeit markers in the order internal, forfeit', () => {
    expect(resultMarkers({ derby: false, forfeit: false })).toEqual([])
    expect(resultMarkers({ derby: true, forfeit: false })).toEqual(['internal'])
    expect(resultMarkers({ derby: true, forfeit: true })).toEqual(['internal', 'forfeit'])
  })
})

describe('ResultsCard', () => {
  it('shows each outcome in the legend with its count and the server\'s percentage, the zero ones included', () => {
    draw(<ResultsCard data={makeTeamDashboard()} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Results' })).toBeInTheDocument()
    const legend = within(screen.getByTestId('donut-legend')).getAllByRole('listitem').map((item) => item.textContent)
    expect(legend).toEqual(['Won9 · 64.3%', 'Lost4 · 28.6%', 'Tied1 · 7.1%', 'Drawn0 · 0.0%', 'No result0 · 0.0%'])
  })

  it('the table has an Outcome, Results, Share column and a Played total taken from the server (14), not the rows', async () => {
    draw(<ResultsCard data={makeTeamDashboard()} dimmed={false} />)
    await openTable('results')
    expect(headers()).toEqual(['Outcome', 'Results', 'Share'])
    expect(rows('results')).toEqual([['Won', '9', '64.3%'], ['Lost', '4', '28.6%'], ['Tied', '1', '7.1%'], ['Drawn', '0', '0.0%'], ['No result', '0', '0.0%']])
    expect(cells(screen.getByTestId('results-total'))).toEqual(['Played', '14', ''])
  })

  it('a null share is a dash, not 0%', async () => {
    const data = makeTeamDashboard()
    draw(<ResultsCard data={{ ...data, resultsSummary: { ...data.resultsSummary, drawnPercent: null } }} dimmed={false} />)
    await openTable('results')
    expect(rows('results')[3]).toEqual(['Drawn', '0', '–'])
  })

  it('states how forfeits are counted, with their number when there are some', () => {
    const one = draw(<ResultsCard data={makeTeamDashboard()} dimmed={false} />)
    expect(screen.getByTestId('results-coverage')).toHaveTextContent('Includes 1 forfeit, counted as a win or a loss as in the record.')
    one.unmount()
    const data = makeTeamDashboard()
    draw(<ResultsCard data={{ ...data, resultsSummary: { ...data.resultsSummary, forfeits: 0 } }} dimmed={false} />)
    expect(screen.getByTestId('results-coverage')).toHaveTextContent('Forfeits are counted as a win or a loss, as in the record.')
  })

  it('shows an empty message and no table toggle when nothing was played', () => {
    const data = makeTeamDashboard()
    draw(<ResultsCard data={{ ...data, resultsSummary: { ...data.resultsSummary, played: 0 } }} dimmed={false} />)
    expect(screen.getByTestId('results-empty')).toHaveTextContent('No results to show')
    expect(screen.queryByTestId('results-view-table')).not.toBeInTheDocument()
  })
})

describe('RunsScoredCard', () => {
  it('lists the results oldest first with the result in words, a forfeit and a derby marked in text, and a dash for runs not on file', async () => {
    draw(<RunsScoredCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Runs scored v conceded' })).toBeInTheDocument()
    await openTable('runs-scored')
    expect(headers()).toEqual(['Date', 'Opponent', 'Result', 'Scored', 'Conceded'])
    expect(rows('runs-scored')).toEqual([
      ['1 Mar 2026', 'Opponent 1', 'Won', '151/6', '121/10'],
      ['2 Mar 2026', 'Opponent 2', 'Lost', '100/6', '130/10'],
      ['3 Mar 2026', 'Opponent 3', 'Won · forfeit', '–', '–'],
      ['4 Mar 2026', 'Internal match', 'Drawn · internal', '154/6', '124/10'],
    ])
  })

  it('shows the runs without wickets when wickets are not recorded', async () => {
    const data = makeTeamDashboard({ results: [makeTeamResult(1, { ownWickets: null, oppWickets: null })] })
    draw(<RunsScoredCard data={data} backTo={BACK} dimmed={false} />)
    await openTable('runs-scored')
    expect(rows('runs-scored')[0].slice(3)).toEqual(['151', '121'])
  })

  it('says how many results have runs on both sides, and names a window, from the server\'s counts', () => {
    const data = makeTeamDashboard()
    draw(<RunsScoredCard data={{ ...data, resultsSummary: { ...data.resultsSummary, totalPoints: 14, shown: 4, withRuns: 3 } }} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('runs-scored-coverage')).toHaveTextContent('Last 4 of 14 results; the Played tile counts all 14. Runs shown for 3 of 4 results.')
    expect(screen.getByTestId('runs-scored-description')).toHaveTextContent('4 results shown, 3 with runs recorded on both sides.')
  })

  it('shows distinct empty messages for no results and for no runs', () => {
    const none = draw(<RunsScoredCard data={makeTeamDashboard({ results: [] })} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('runs-scored-empty')).toHaveTextContent('No results to show')
    none.unmount()
    const data = makeTeamDashboard()
    draw(<RunsScoredCard data={{ ...data, resultsSummary: { ...data.resultsSummary, withRuns: 0 } }} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('runs-scored-empty')).toHaveTextContent('No runs to show')
  })

  it('its legend explains the result letters', () => {
    draw(<RunsScoredCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByText('Letter: W won, L lost, T tied, D drawn, NR no result')).toBeInTheDocument()
  })
})

describe('RunRateTrendCard', () => {
  it('with net run rate SHOWN, adds the third line to the legend and a Net run rate column (signed), from the server\'s points', async () => {
    draw(<RunRateTrendCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    const legend = within(screen.getByRole('list', { name: 'Run rate trend' })).getAllByRole('listitem').map((item) => item.textContent)
    expect(legend).toEqual(['Team run rate', 'Opposition run rate', 'Net run rate'])
    expect(screen.queryByTestId('run-rate-trend-coverage')).not.toBeInTheDocument()
    await openTable('run-rate-trend')
    expect(headers()).toEqual(['Date', 'Opponent', 'Team', 'Opposition', 'Net run rate'])
    expect(rows('run-rate-trend')).toEqual([
      ['1 Mar 2026', 'Opponent 1', '4.50', '3.60', '+0.90'],
      ['2 Mar 2026', 'Opponent 2', '4.25', 'Not recorded', '+0.84'],
    ])
  })

  it.each([
    ['NOT_ONE_COMPETITION', 'Net run rate is not shown across more than one league or season'],
    ['NO_USABLE_RESULTS', 'Net run rate needs won or tied results with both innings recorded'],
  ] as const)('with net run rate %s, has two lines, no net column, and the reason as the caption', async (status, reason) => {
    draw(<RunRateTrendCard data={makeTeamDashboard({ netRunRateTrend: { status, points: null } })} backTo={BACK} dimmed={false} />)
    expect(within(screen.getByRole('list', { name: 'Run rate trend' })).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByTestId('run-rate-trend-coverage')).toHaveTextContent(reason)
    await openTable('run-rate-trend')
    expect(headers()).toEqual(['Date', 'Opponent', 'Team', 'Opposition'])
  })

  it('a net run rate point missing for a result is "Not recorded"', async () => {
    const data = makeTeamDashboard()
    draw(<RunRateTrendCard data={{ ...data, netRunRateTrend: { status: 'SHOWN', points: [data.netRunRateTrend.points![0]] } }} backTo={BACK} dimmed={false} />)
    await openTable('run-rate-trend')
    expect(rows('run-rate-trend')[1][4]).toBe('Not recorded')
  })

  it('is the full-width card and shows an empty message with no run rate', () => {
    const wide = draw(<RunRateTrendCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('dashboard-card-run-rate-trend')).toHaveAttribute('data-width', 'full')
    wide.unmount()
    draw(<RunRateTrendCard data={makeTeamDashboard({ runRateTrend: [] })} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('run-rate-trend-empty')).toHaveTextContent('No run rate to show')
  })
})

describe('ExtrasConcededCard', () => {
  it('has the eight columns and "Not recorded" cells, never 0, a total-only match marked Not itemised and a gap for no extras', async () => {
    draw(<ExtrasConcededCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Extras conceded' })).toBeInTheDocument()
    await openTable('extras-conceded')
    expect(headers()).toEqual(['Date', 'Opponent', 'Wides', 'No-balls', 'Byes', 'Leg-byes', 'Penalty', 'Total'])
    expect(rows('extras-conceded')).toEqual([
      ['1 Mar 2026', 'Opponent 1', '4', '1', '2', '3', '0', '10'],
      ['2 Mar 2026', 'Opponent 2', 'Not recorded', '1', 'Not recorded', '3', '0', '7'],
      ['3 Mar 2026', 'Opponent 3', 'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded', '12 (Not itemised)'],
      ['4 Mar 2026', 'Opponent 4', 'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded'],
    ])
  })

  it('has "Lower is better", a legend of the five types and the grey Not itemised entry', () => {
    draw(<ExtrasConcededCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('extras-conceded-note')).toHaveTextContent('Lower is better')
    const legend = within(screen.getByRole('list', { name: 'Extras types' })).getAllByRole('listitem').map((item) => item.textContent)
    expect(legend).toEqual(['Wides', 'No-balls', 'Byes', 'Leg-byes', 'Penalty', 'Not itemised'])
    // each entry carries a swatch, the types a pattern except the flat grey one
    expect(screen.getByRole('list', { name: 'Extras types' }).querySelectorAll('pattern').length).toBeGreaterThanOrEqual(4)
  })

  it('prints "Extras recorded for N of M matches" when incomplete, adding the itemised count when it differs', () => {
    draw(<ExtrasConcededCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('extras-conceded-coverage')).toHaveTextContent('Extras recorded for 3 of 14 matches, itemised for 2.')
  })

  it('has no recorded-coverage caption when every match has itemised extras', () => {
    const data = makeTeamDashboard({ extrasConceded: [makeExtrasPoint(1)], extrasSummary: { ...makeTeamDashboard().extrasSummary, matchesCounted: 1, matchesWithExtras: 1, matchesItemised: 1, totalPoints: 1, shown: 1 } })
    draw(<ExtrasConcededCard data={data} backTo={BACK} dimmed={false} />)
    expect(screen.queryByTestId('extras-conceded-coverage')).not.toBeInTheDocument()
  })

  it('shows the empty line when no match has extras', () => {
    draw(<ExtrasConcededCard data={makeTeamDashboard({ extrasSummary: { ...makeTeamDashboard().extrasSummary, matchesWithExtras: 0 } })} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('extras-conceded-empty')).toHaveTextContent('No extras have been recorded for these matches.')
    expect(screen.queryByTestId('extras-conceded-view-table')).not.toBeInTheDocument()
  })
})

describe('DotBallsCard', () => {
  it('has the five columns, "Not recorded" where dots are not recorded for every bowler, and one decimal on the percentage', async () => {
    draw(<DotBallsCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByRole('img', { name: 'Dot balls' })).toBeInTheDocument()
    await openTable('dot-balls')
    expect(headers()).toEqual(['Date', 'Opponent', 'Balls bowled', 'Dot balls', 'Dot %'])
    expect(rows('dot-balls')).toEqual([
      ['1 Mar 2026', 'Opponent 1', '120', '48', '40.0%'],
      ['2 Mar 2026', 'Opponent 2', '120', '40', '33.3%'],
      ['3 Mar 2026', 'Opponent 3', 'Not recorded', 'Not recorded', 'Not recorded'],
    ])
  })

  it('passes the average through (36.7, not the 36.65 the two points would average), with "Higher is better" and the server\'s trend sentence', () => {
    draw(<DotBallsCard data={makeTeamDashboard()} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('dot-balls-note')).toHaveTextContent('Higher is better')
    expect(screen.getByTestId('dot-balls-description')).toHaveTextContent('average 36.7%')
    expect(screen.getByTestId('dot-balls-footer')).toHaveTextContent('Last 5 matches: 38.2% dot balls, up from 33.9% in the 5 before.')
    expect(screen.getByTestId('dot-balls-coverage')).toHaveTextContent('Dot balls recorded for 2 of 14 matches.')
  })

  it('has no trend sentence when the server sent none, and no average when null', () => {
    const base = makeTeamDashboard().dotBallsSummary
    draw(<DotBallsCard data={makeTeamDashboard({ dotBallsSummary: { ...base, averageDotPercent: null, recentAverage: null, earlierAverage: null, direction: null } })} backTo={BACK} dimmed={false} />)
    expect(screen.queryByTestId('dot-balls-footer')).not.toBeInTheDocument()
    expect(screen.getByTestId('dot-balls-description')).not.toHaveTextContent('average')
  })

  it('shows the empty line when dots were not recorded for any match', () => {
    const base = makeTeamDashboard().dotBallsSummary
    draw(<DotBallsCard data={makeTeamDashboard({ dotBalls: [makeDotsPoint(1, { dots: null, ballsBowled: null, dotPercent: null })], dotBallsSummary: { ...base, matchesWithDots: 0 } })} backTo={BACK} dimmed={false} />)
    expect(screen.getByTestId('dot-balls-empty')).toHaveTextContent('No dot balls have been recorded for these matches.')
  })

  it('a recorded 0 percent is a real figure in the table, not "Not recorded"', async () => {
    draw(<DotBallsCard data={makeTeamDashboard({ dotBalls: [makeDotsPoint(1, { dots: 0, dotPercent: 0 })] })} backTo={BACK} dimmed={false} />)
    await openTable('dot-balls')
    expect(rows('dot-balls')[0]).toEqual(['1 Mar 2026', 'Opponent 1', '120', '0', '0.0%'])
  })
})
