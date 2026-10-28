import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HubLeagueCard } from './HubLeagueCard'
import { leagueSummary } from '../../../test/hubLeagueFixtures'

describe('HubLeagueCard', () => {
  it('is one button naming the league, season and the player\'s team, with the facts line', async () => {
    const onOpen = vi.fn()
    render(<HubLeagueCard league={leagueSummary()} seasonName="2026/27" onOpen={onOpen} />)

    const card = screen.getByRole('button', { name: 'Boland Under 15, 2026/27, your team Paarl U15' })
    expect(card).toHaveTextContent('Under 15 · 8 teams · Next match 7 Nov 2026')
    await userEvent.setup().click(card)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('says 1 team and leaves out the age and next match when there are none', () => {
    render(<HubLeagueCard league={leagueSummary({ name: 'Cape Premier', maxAge: null, teamCount: 1, nextMatchDate: null, myTeams: [] })} onOpen={vi.fn()} />)

    const card = screen.getByTestId('hub-league-card')
    expect(card).toHaveTextContent('1 team')
    expect(card).not.toHaveTextContent('Next match')
    expect(card).not.toHaveTextContent('Under')
  })
})
