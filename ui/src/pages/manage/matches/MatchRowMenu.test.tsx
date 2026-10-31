import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MatchRowMenu, availabilityMenuItems, titleCase } from './MatchRowMenu'
import { makeMatch, makeTeam, makeTeams } from './matchTestUtils'

const teams = makeTeams(makeTeam('team-1', '1st XI'), makeTeam('team-2', '2nd XI'))

function renderMenu(match = makeMatch()) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/manage/fixtures/matches']}>
        <MatchRowMenu clubId="club-1" match={match} teamsById={teams} leaguesById={new Map()} seasonsById={new Map()} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MatchRowMenu', () => {
  it('is one kebab named for the match, with Open Match and Edit Match first and Share Match last', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button', { name: 'Actions for 1st XI v Riverside Occasionals' }))
    const items = within(await screen.findByRole('menu')).getAllByRole('menuitem')
    expect(items[0]).toHaveTextContent('Open Match')
    expect(items[1]).toHaveTextContent('Edit Match')
    expect(items[items.length - 2]).toHaveTextContent('Share Team Sheet')
    expect(items[items.length - 1]).toHaveTextContent('Share Match')
  })

  it('titleCase capitalises each word of a result label', () => {
    expect(titleCase('continue result')).toBe('Continue Result')
  })

  it('availabilityMenuItems gives one link item for a link destination and a named item per poll for a menu', () => {
    const leave = (to: string) => `${to}&x=1`
    expect(availabilityMenuItems({ kind: 'link', to: '/a?b=1' }, leave, null)).toEqual([
      expect.objectContaining({ id: 'availability', title: 'Open Availability', to: '/a?b=1&x=1', disabled: false }),
    ])
    const many = availabilityMenuItems({ kind: 'menu', options: [{ label: 'A', to: '/p1?q=1' }, { label: 'B', to: '/p2?q=1' }] }, leave, 'Why')
    expect(many.map((item) => item.title)).toEqual(['Open Availability: A', 'Open Availability: B'])
    expect(many[0]).toEqual(expect.objectContaining({ disabled: true, reason: 'Why' }))
  })

  it('never opens a window unless Scoring or Watch Live is chosen', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderMenu(makeMatch({ scoringUrl: 'https://s.example/1' }))
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
  })
})
