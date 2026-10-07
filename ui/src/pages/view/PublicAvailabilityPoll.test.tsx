import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicAvailabilityPoll from './PublicAvailabilityPoll'
import type { PublicAvailabilityPoll as PollDto } from '../../api/publicPollApi'
import { identify, problem, renderAt, verified } from '../../test/publicAvailabilityTestUtils'

const getPoll = vi.fn()
const verify = vi.fn()
const getAnswers = vi.fn()
const putAnswers = vi.fn()

vi.mock('../../api/publicPollApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/publicPollApi')>()),
  getPoll: (...args: unknown[]) => getPoll(...args),
  verify: (...args: unknown[]) => verify(...args),
  getAnswers: (...args: unknown[]) => getAnswers(...args),
  putAnswers: (...args: unknown[]) => putAnswers(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

function makePoll(overrides: Partial<PollDto> = {}): PollDto {
  return {
    pollId: 'poll-1',
    open: true,
    clubId: 'club-1',
    homeTeamName: 'Riverside CC',
    awayTeamName: 'Oakwood CC',
    matchDate: '2030-10-04T09:00:00Z',
    venue: 'Central Oval',
    leagueName: 'Premier League',
    seasonLabel: '2030/31',
    teamName: 'Riverside CC',
    scheduledCloseAt: '2030-10-03T09:00:00Z',
    ...overrides,
  }
}

const renderPage = () => renderAt('/poll/poll-1', '/poll/:pollId', <PublicAvailabilityPoll />)

describe('PublicAvailabilityPoll (squad poll)', () => {
  it('walks identify, answer, saved and remembers the name on the device', async () => {
    getPoll.mockResolvedValue(makePoll())
    verify.mockResolvedValue(verified())
    getAnswers.mockResolvedValue({ answers: [] })
    putAnswers.mockResolvedValue({ answers: [{ windowId: null, status: 'AVAILABLE' }] })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside CC v Oakwood CC' })).toBeInTheDocument()
    expect(screen.getByText(/^Open · closes /)).toBeInTheDocument()
    await identify(user, { first: 'Liam', last: 'Carter' })

    expect(verify).toHaveBeenCalledWith('poll-1', { firstName: 'Liam', lastName: 'Carter', dateOfBirth: '1985-03-04' })
    expect(await screen.findByText('✓ Confirmed')).toBeInTheDocument()
    expect(getAnswers).toHaveBeenCalledWith('poll-1', 'player-1', 'tok-1')

    await user.click(screen.getByRole('button', { name: 'Availability: Available' }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))

    expect(putAnswers).toHaveBeenCalledWith('poll-1', 'player-1', 'tok-1', [{ windowId: null, status: 'AVAILABLE' }])
    expect(await screen.findByText('Thanks, Liam')).toBeInTheDocument()
    expect(screen.getByText('Your answer')).toBeInTheDocument()

    const stored = localStorage.getItem('cricketlegend.publicAvailability.players.v1') ?? ''
    expect(stored).toContain('Liam')
    expect(stored).not.toContain('1985')
    expect(stored).not.toContain('tok-1')
    expect(stored).not.toContain('player-1')
  })

  it('prefills an existing answer so a vote can be changed, then saves the new one', async () => {
    getPoll.mockResolvedValue(makePoll())
    verify.mockResolvedValue(verified())
    getAnswers.mockResolvedValue({ answers: [{ windowId: null, status: 'UNSURE' }] })
    putAnswers.mockResolvedValue({ answers: [{ windowId: null, status: 'UNAVAILABLE' }] })
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { level: 1 })
    await identify(user, { first: 'Liam', last: 'Carter' })
    expect(await screen.findByRole('button', { name: 'Availability: Unsure' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/You already answered/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Availability: Unavailable' }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    expect(putAnswers).toHaveBeenCalledWith('poll-1', 'player-1', 'tok-1', [{ windowId: null, status: 'UNAVAILABLE' }])
    expect(await screen.findByText('Unavailable')).toBeInTheDocument()

    // Change my answer returns to the answer step without asking the date again.
    await user.click(screen.getByRole('button', { name: 'Change my answer' }))
    expect(screen.getByRole('button', { name: 'Save my answer' })).toBeInTheDocument()
    expect(verify).toHaveBeenCalledTimes(1)
  })

  it('returns to identify with a notice and keeps the chosen answer when the token has expired', async () => {
    getPoll.mockResolvedValue(makePoll())
    verify.mockResolvedValue(verified())
    getAnswers.mockResolvedValue({ answers: [] })
    putAnswers.mockRejectedValueOnce(problem(401)).mockResolvedValueOnce({ answers: [{ windowId: null, status: 'UNSURE' }] })
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { level: 1 })
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: 'Availability: Unsure' }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))

    expect(await screen.findByText(/Your 30 minutes ran out, enter your details again/)).toBeInTheDocument()
    // The name is kept, only the date is asked again.
    expect(screen.getByText('Hi Liam, confirm it is you')).toBeInTheDocument()
    const day = screen.getByLabelText('Day')
    await user.type(day, '4')
    await user.type(screen.getByLabelText('Month'), '3')
    await user.type(screen.getByLabelText('Year'), '1985')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('button', { name: 'Availability: Unsure' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    await waitFor(() => expect(putAnswers).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Thanks, Liam')).toBeInTheDocument()
  })

  it('shows a closed poll as read-only with no form', async () => {
    getPoll.mockResolvedValue(makePoll({ open: false }))
    renderPage()
    expect(await screen.findByText('Closed')).toBeInTheDocument()
    expect(screen.getByText(/This poll has closed/)).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
  })

  it('shows a friendly page for an unknown link', async () => {
    getPoll.mockRejectedValue(problem(404))
    renderPage()
    expect(await screen.findByText('Poll not found')).toBeInTheDocument()
  })

  it('shows a generic message when the poll cannot be loaded', async () => {
    getPoll.mockRejectedValue(problem(500))
    renderPage()
    expect(await screen.findByText("Couldn't load this poll")).toBeInTheDocument()
  })

  it('copes with a missing match date, venue and team names', async () => {
    getPoll.mockResolvedValue(
      makePoll({ homeTeamName: null, awayTeamName: null, matchDate: null, venue: null, leagueName: null, seasonLabel: null, teamName: null, scheduledCloseAt: null }),
    )
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Home v TBC' })).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
  })
})
