import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HubLeagueResults, HubLeagueSchedule } from './HubLeagueGames'
import { leagueDto } from '../../../test/hubLeagueFixtures'

// docs/specs/123 (Schedule and Results): the whole league, own games highlighted and tagged, "Only my games" filters.
const games = () => screen.getAllByRole('article')

describe('HubLeagueSchedule', () => {
  it('lists every league match under its date, with own games tagged and highlighted', () => {
    render(<HubLeagueSchedule dto={leagueDto()} />)

    expect(games()).toHaveLength(2)
    expect(screen.getByRole('region', { name: /^Saturday,? 7 November 2099$/ })).toBeInTheDocument()
    const [mine, other] = games()
    expect(mine).toHaveAttribute('data-mine', 'true')
    expect(within(mine).getByText('Your game')).toBeInTheDocument()
    expect(mine).toHaveTextContent('09:30 · Riverside Oval')
    expect(other).not.toHaveAttribute('data-mine')
    expect(within(other).queryByText('Your game')).not.toBeInTheDocument()
  })

  it('"Only my games" is off at first and hides the other games when on', async () => {
    render(<HubLeagueSchedule dto={leagueDto()} />)
    const toggle = screen.getByRole('checkbox', { name: 'Only my games' })
    expect(toggle).not.toBeChecked()

    await userEvent.setup().click(toggle)

    expect(games()).toHaveLength(1)
    expect(games()[0]).toHaveAttribute('data-mine', 'true')
  })

  it('says so when "Only my games" leaves nothing, and when there is no schedule', async () => {
    const dto = leagueDto()
    const { unmount } = render(<HubLeagueSchedule dto={{ ...dto, schedule: dto.schedule.filter((row) => !row.mine) }} />)
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Only my games' }))
    expect(screen.getByText('None of your games are scheduled yet.')).toBeInTheDocument()
    unmount()

    render(<HubLeagueSchedule dto={{ ...dto, schedule: [] }} />)
    expect(screen.getByText('No matches scheduled yet.')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('HubLeagueResults', () => {
  it('lists published results newest first with scores and result lines, own games tagged', () => {
    render(<HubLeagueResults dto={leagueDto()} />)

    const [first, second] = games()
    expect(first).toHaveTextContent('Hermanus U15 won by 7 wickets')
    expect(first).not.toHaveAttribute('data-mine')
    expect(second).toHaveTextContent('150/6')
    expect(second).toHaveTextContent('Paarl U15 won by 30 runs')
    expect(within(second).getByText('Your game')).toBeInTheDocument()
  })

  it('filters to own games, and has its own empty lines', async () => {
    const dto = leagueDto()
    const { unmount } = render(<HubLeagueResults dto={dto} />)
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Only my games' }))
    expect(games()).toHaveLength(1)
    unmount()

    const { unmount: again } = render(<HubLeagueResults dto={{ ...dto, results: dto.results.filter((r) => !r.mine) }} />)
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Only my games' }))
    expect(screen.getByText('None of your games have a published result yet.')).toBeInTheDocument()
    again()

    render(<HubLeagueResults dto={{ ...dto, results: [] }} />)
    expect(screen.getByText('No results published yet.')).toBeInTheDocument()
  })
})
