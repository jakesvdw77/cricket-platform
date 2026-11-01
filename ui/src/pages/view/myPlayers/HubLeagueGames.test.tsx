import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as baseRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HubLeagueResults, HubLeagueSchedule } from './HubLeagueGames'
import { leagueDto } from '../../../test/hubLeagueFixtures'

const render = (node: ReactElement) =>
  baseRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>)

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

// docs/specs/133 (Player Hub rows): Get Directions and the forecast come from the position the row carries.
describe('HubLeagueSchedule location', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  const withPosition = (patch: Record<string, unknown> = {}) => {
    const dto = leagueDto()
    return { ...dto, schedule: [{ ...dto.schedule[0], playingAreaName: 'Riverside Oval', playingAreaLatitude: -33.7, playingAreaLongitude: 18.96, ...patch }, dto.schedule[1]] }
  }

  it('shows Get Directions on a row with a stored position and none on a row without one', () => {
    render(<HubLeagueSchedule dto={withPosition()} />)
    const [first, second] = games()
    expect(within(first).getByRole('button', { name: 'Get Directions' })).toBeInTheDocument()
    expect(within(second).queryByRole('button', { name: /Get Directions/ })).not.toBeInTheDocument()
  })

  it('opens Google Maps with the stored coordinates in one click on a desktop', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<HubLeagueSchedule dto={withPosition()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Get Directions' }))
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=-33.7,18.96', '_blank', 'noopener,noreferrer')
  })

  it('goes to the access point when the row has one', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<HubLeagueSchedule dto={withPosition({ playingAreaAccessLatitude: -33.71, playingAreaAccessLongitude: 18.97 })} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Get Directions' }))
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=-33.71,18.97', '_blank', 'noopener,noreferrer')
  })

  it('shows the forecast badge for a match within the next week', async () => {
    const day = new Date()
    day.setDate(day.getDate() + 2)
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const body = { daily: { time: [iso], weather_code: [1], temperature_2m_max: [27], temperature_2m_min: [14], precipitation_probability_max: [20] } }
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })))
    render(<HubLeagueSchedule dto={withPosition({ date: iso })} />)
    expect(await screen.findByTestId('hub-row-weather')).toHaveTextContent('14 to 27 degrees, 20% rain')
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
