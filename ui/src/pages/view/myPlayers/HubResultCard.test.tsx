import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HubGameCard } from './HubGameCard'
import { HubResultCard } from './HubResultCard'
import type { HubResultCardProps } from './HubResultCard'
import type { MyResultRow } from '../../../api/meResultsApi'
import { battingRow, bowlingRow, didNotBatRow, noCardRow } from '../../../test/hubResultFixtures'
import { resultRow } from '../../../test/tickerFixtures'

// docs/specs/145 decision 11: the result leads (the headline, both scores, the league and team) and the player's own contribution is a
// slim strip at the foot. One stretched link to the Hub Result page carries the scope. The copy names the player, never "you".
const renderCard = (row: MyResultRow, props: Partial<HubResultCardProps> = {}) =>
  render(
    <MemoryRouter>
      <HubResultCard playerKey="k1" playerName="Aman" row={row} {...props} />
    </MemoryRouter>,
  )

describe('HubResultCard', () => {
  it('leads with the result line, both scores, the league and our team, then the batting strip', () => {
    renderCard(battingRow({ ourTeams: [{ side: 'HOME', teamId: 't1', teamName: 'U15 A' }] }))
    const card = screen.getByTestId('hub-result-card')
    expect(card).toHaveAttribute('data-tone', 'win')
    expect(within(card).getByText('Villagers beat Rovers by 24 runs')).toBeInTheDocument()
    expect(within(card).getByText('180/4')).toBeInTheDocument()
    expect(within(card).getByText('156/9')).toBeInTheDocument()
    expect(card).toHaveTextContent('Over 40 · U15 A')
    expect(within(card).getByTestId('result-player-strip')).toHaveTextContent('Aman batted 46, off 40 balls, 4 fours, 1 six')
  })

  it('is one link to the result page that carries the scope, named with the opponent and date', () => {
    renderCard(battingRow(), { scopeQuery: 'season=s1&league=l1' })
    const link = screen.getByRole('link', { name: /^Open the result: v Rovers, / })
    expect(link).toHaveAttribute('href', '/account/players/k1/results/r1?season=s1&league=l1')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('marks the latest result with its kicker and test id', () => {
    renderCard(battingRow(), { latest: true })
    expect(screen.getByTestId('hub-result-latest')).toHaveTextContent('Latest Result')
    expect(screen.queryByTestId('hub-result-card')).not.toBeInTheDocument()
  })

  it('tones a loss and a tie, and a draw stays neutral', () => {
    const { unmount } = renderCard(battingRow({ result: 'LOST', resultLine: 'Rovers beat Villagers by 5 wickets' }))
    expect(screen.getByTestId('hub-result-card')).toHaveAttribute('data-tone', 'loss')
    unmount()
    const tie = renderCard(battingRow({ result: 'TIED', resultLine: null }))
    expect(screen.getByTestId('hub-result-card')).toHaveAttribute('data-tone', 'tie')
    expect(within(screen.getByTestId('hub-result-card')).getByText('Tied')).toBeInTheDocument()
    tie.unmount()
    renderCard(battingRow({ result: 'DRAWN' }))
    expect(screen.getByTestId('hub-result-card')).toHaveAttribute('data-tone', 'neutral')
  })

  it('shows a bowling strip with the figures and overs', () => {
    renderCard(bowlingRow())
    expect(screen.getByTestId('result-player-strip')).toHaveTextContent('Aman bowled 2/21, 4 overs')
  })

  it('shows a did-not-bat strip, with catches when there were some', () => {
    renderCard(didNotBatRow({ fielding: { status: 'RECORDED', catches: 2, stumpings: 0, runOuts: 0 } }))
    expect(screen.getByTestId('result-player-strip')).toHaveTextContent('Aman did not bat, 2 catches')
  })

  it('says the scorecard was not captured when there is no card', () => {
    renderCard(noCardRow())
    expect(screen.getByTestId('result-player-strip')).toHaveTextContent('No scorecard captured')
  })

  it('shows the milestone star for player of the match, and team player of the match otherwise', () => {
    const { unmount } = renderCard(battingRow({ awards: { playerOfTheMatch: 1, teamPlayerOfTheMatch: 1 } }))
    expect(screen.getByTestId('result-player-strip')).toHaveTextContent('Player of the match')
    unmount()
    renderCard(battingRow({ awards: { playerOfTheMatch: 0, teamPlayerOfTheMatch: 1 } }))
    expect(screen.getByTestId('result-player-strip')).toHaveTextContent('Team player of the match')
  })

  it('shows no star without an award', () => {
    renderCard(battingRow())
    expect(screen.getByTestId('result-player-strip')).not.toHaveTextContent(/of the match/)
  })

  it('names a derby by both sides and a friendly as Friendly', () => {
    renderCard(battingRow({ derby: true, homeName: 'Villagers A', awayName: 'Villagers B', competition: 'FRIENDLY', ourTeams: [{ side: 'HOME', teamName: 'A' }, { side: 'AWAY', teamName: 'B' }] }))
    const card = screen.getByTestId('hub-result-card')
    expect(card).toHaveTextContent('Villagers A v Villagers B')
    expect(card).toHaveTextContent('Friendly · A and B')
  })

  it('shows a dash for a side with no score and never says "you"', () => {
    renderCard(battingRow({ awayScore: '' }))
    expect(screen.getByTestId('hub-result-card')).toHaveTextContent('-')
    expect(screen.getByTestId('hub-result-card').textContent).not.toMatch(/\byou(r)?\b/i)
  })
})

describe('HubGameCard (the player\'s own card on the Hub Result page)', () => {
  const renderGame = (row: MyResultRow) => render(<HubGameCard playerName="Aman" row={row} />)

  it('draws the batting figure, balls faced, how out, the story and the runs mix', () => {
    renderGame(battingRow())
    const card = screen.getByTestId('hub-game-card')
    expect(card).toHaveAttribute('data-kind', 'batting')
    expect(screen.getByTestId('result-figure')).toHaveTextContent('46')
    expect(card).toHaveTextContent('off 40 balls')
    expect(card).toHaveTextContent('caught')
    expect(card).toHaveTextContent('46 runs in the win, with 5 boundaries.')
    expect(screen.getByTestId('runs-mix-bar')).toBeInTheDocument()
  })

  it('shows a not out innings with a star and "not out"', () => {
    const row = battingRow()
    renderGame(battingRow({ batting: { ...row.batting, innings: [{ runs: 46, balls: 40, notOut: true, fours: 4, sixes: 1 }] } }))
    expect(screen.getByTestId('result-figure')).toHaveTextContent('46*')
    expect(screen.getByTestId('hub-game-card')).toHaveTextContent('not out')
  })

  it('draws the bowling figure with overs and economy and the over blocks, headed Bowling', () => {
    renderGame(bowlingRow())
    const card = screen.getByTestId('hub-game-card')
    expect(card).toHaveAttribute('data-kind', 'bowling')
    expect(screen.getByTestId('result-figure')).toHaveTextContent('2/21')
    expect(card).toHaveTextContent('Aman · Bowling')
    expect(card).toHaveTextContent('in 4 overs')
    expect(card).toHaveTextContent('economy 5.3')
    expect(screen.getByTestId('over-blocks')).toBeInTheDocument()
  })

  it('draws the did-not-bat card with catches and no drawing', () => {
    renderGame(didNotBatRow({ fielding: { status: 'RECORDED', catches: 1, stumpings: 0, runOuts: 0 } }))
    const card = screen.getByTestId('hub-game-card')
    expect(card).toHaveAttribute('data-kind', 'noBat')
    expect(card).toHaveTextContent('Did Not Bat')
    expect(screen.getByTestId('result-catches')).toHaveTextContent('1 Catch')
    expect(screen.queryByTestId('runs-mix-bar')).not.toBeInTheDocument()
  })

  it('draws "No Card" when nothing was captured', () => {
    renderGame(noCardRow())
    expect(screen.getByTestId('hub-game-card')).toHaveTextContent('No Card')
    expect(screen.getByTestId('hub-game-card')).toHaveTextContent('No scorecard was captured for this match.')
  })

  it('shows the star as Player Of The Match in the kicker', () => {
    renderGame(resultRow({ awards: { playerOfTheMatch: 1, teamPlayerOfTheMatch: 0 } }))
    expect(screen.getByTestId('hub-game-card')).toHaveTextContent('Aman')
    expect(screen.getByTestId('hub-game-card')).toHaveTextContent('Player Of The Match')
  })
})
