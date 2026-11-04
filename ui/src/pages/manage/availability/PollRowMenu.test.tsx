import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PollRowMenu } from './PollRowMenu'
import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { Team } from '../../../api/teamApi'

vi.mock('../../../api/matchAvailabilityApi', () => ({
  closePoll: vi.fn(),
  deletePoll: vi.fn(),
  openPoll: vi.fn(),
  updatePollCloseTime: vi.fn(),
}))

const poll: OpenAvailabilityPoll = {
  pollId: 'poll-1',
  matchId: 'match-1',
  teamId: 'team-home',
  homeTeamId: 'team-home',
  homeTeamName: null,
  awayTeamId: null,
  awayTeamName: 'Rivals CC',
  matchDate: '2030-06-01T09:00:00Z',
  venue: 'Home Ground',
  autoClose: true,
  scheduledCloseAt: '2030-05-31T09:00:00Z',
  canReopen: true,
  availableCount: 0,
  unavailableCount: 0,
  unsureCount: 0,
  noResponseCount: 0,
  availableRespondents: [],
  unavailableRespondents: [],
  unsureRespondents: [],
}
const teamsById = new Map<string, Team>([['team-home', { id: 'team-home', name: 'Home Team' } as Team]])

function Probe() {
  const location = useLocation()
  return <div>{`At ${location.pathname}${location.search}`}</div>
}

function renderMenu() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/availability']}>
        <Routes>
          <Route
            path="/manage/availability"
            element={
              <div onClick={() => window.dispatchEvent(new Event('row-clicked'))}>
                <PollRowMenu clubId="club-1" item={{ kind: 'SQUAD', poll }} teamsById={teamsById} onChanged={vi.fn()} />
              </div>
            }
          />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PollRowMenu (docs/specs/136)', () => {
  it('is one kebab named for the poll, whose menu ends with Share Invite', async () => {
    renderMenu()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Actions for Home Team vs Rivals CC' }))

    const names = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(names[0]).toBe('Open Responses')
    expect(names[names.length - 1]).toBe('Share Invite')
  })

  it('Open Responses carries returnTo with the Availability label', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button', { name: 'Actions for Home Team vs Rivals CC' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open Responses' }))

    const at = (await screen.findByText(/^At \/manage\/availability\/squad\/match-1\/poll-1/)).textContent ?? ''
    expect(decodeURIComponent(at)).toContain('returnTo=/manage/availability')
    expect(at).toContain('returnLabel=Availability')
  })
})
