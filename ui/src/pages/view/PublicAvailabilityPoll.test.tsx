import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicAvailabilityPoll from './PublicAvailabilityPoll'
import type { PublicAvailabilityPoll as PublicAvailabilityPollDto } from '../../api/publicPollApi'

const getPoll = vi.fn()
const setAvailability = vi.fn()

vi.mock('../../api/publicPollApi', () => ({
  getPoll: (pollId: string) => getPoll(pollId),
  setAvailability: (pollId: string, playerProfileId: string, status: string) =>
    setAvailability(pollId, playerProfileId, status),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makePoll(overrides: Partial<PublicAvailabilityPollDto> = {}): PublicAvailabilityPollDto {
  return {
    pollId: 'poll-1',
    open: true,
    homeTeamName: 'Riverside CC',
    awayTeamName: 'Oakwood CC',
    matchDate: '2026-10-04T09:00:00Z',
    venue: 'Central Oval',
    leagueName: 'Premier League',
    seasonLabel: '2026/27',
    teamName: 'Riverside CC',
    responses: [
      { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7, status: 'AVAILABLE' },
      { playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones', squadJerseyNumber: null, status: null },
    ],
    ...overrides,
  }
}

function renderPage(pollId = 'poll-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/poll/${pollId}`]}>
        <Routes>
          <Route path="/poll/:pollId" element={<PublicAvailabilityPoll />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicAvailabilityPoll', () => {
  it('renders squad rows with their current status pre-selected', async () => {
    getPoll.mockResolvedValueOnce(makePoll())
    renderPage()

    expect(await screen.findByText('#7 Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByLabelText('#7 Jane Smith: Available')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Bob Jones: Available')).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders match context — teams, date, venue', async () => {
    getPoll.mockResolvedValueOnce(makePoll())
    renderPage()

    expect(await screen.findByText('Riverside CC vs Oakwood CC')).toBeInTheDocument()
    expect(screen.getByText(/Central Oval/)).toBeInTheDocument()
  })

  it('tapping a status on a row calls setAvailability for that playerProfileId only', async () => {
    const user = userEvent.setup()
    getPoll.mockResolvedValue(makePoll())
    setAvailability.mockResolvedValueOnce(makePoll())
    renderPage()

    await screen.findByText('Bob Jones')
    await user.click(screen.getByLabelText('Bob Jones: Unavailable'))

    expect(setAvailability).toHaveBeenCalledWith('poll-1', 'p2', 'UNAVAILABLE')
  })

  it('disables every row\'s toggle group when the poll is closed', async () => {
    getPoll.mockResolvedValueOnce(makePoll({ open: false }))
    renderPage()

    await screen.findByText('Bob Jones')
    expect(screen.getByText(/this poll is closed/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Bob Jones: Available')).toBeDisabled()
    expect(screen.getByLabelText('#7 Jane Smith: Available')).toBeDisabled()
  })

  it('renders a clean "Poll not found" message on a 404', async () => {
    getPoll.mockRejectedValueOnce(
      new AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: {},
        statusText: 'Not Found',
        headers: {},
        config: {} as never,
      }),
    )
    renderPage('unknown-poll')

    expect(await screen.findByText('Poll not found')).toBeInTheDocument()
  })
})
