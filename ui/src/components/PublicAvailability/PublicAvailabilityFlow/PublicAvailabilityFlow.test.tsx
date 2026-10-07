import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicAvailabilityFlow } from './PublicAvailabilityFlow'
import type { PublicPollAdapter, PublicPollContext } from './adapters'
import { REMEMBERED_PLAYERS_KEY } from '../../../utils/rememberedPlayers'
import { identify, problem, typeDate, verified } from '../../../test/publicAvailabilityTestUtils'

const load = vi.fn()
const verify = vi.fn()
const getAnswers = vi.fn()
const putAnswers = vi.fn()

const adapter: PublicPollAdapter = {
  kind: 'squad',
  queryKey: (id) => ['flow-test', id],
  load: (id) => load(id),
  verify: (id, body) => verify(id, body),
  getAnswers: (id, playerId, token) => getAnswers(id, playerId, token),
  putAnswers: (id, playerId, token, answers) => putAnswers(id, playerId, token, answers),
}

function makeContext(overrides: Partial<PublicPollContext> = {}): PublicPollContext {
  return {
    clubId: 'club-1',
    open: true,
    brandName: 'Irene Villagers',
    title: 'Villagers 1 v POHBS',
    subtitle: null,
    details: [],
    scheduledCloseAt: null,
    slots: [{ key: 'squad', windowId: null, label: null, matches: [], open: true }],
    ...overrides,
  }
}

function renderFlow() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicAvailabilityFlow id="poll-1" adapter={adapter} />
    </QueryClientProvider>,
  )
}

function seedRemembered(players: Array<{ firstName: string; lastName: string; answered?: Record<string, string> }>) {
  const now = new Date().toISOString()
  localStorage.setItem(
    REMEMBERED_PLAYERS_KEY,
    JSON.stringify({
      version: 1,
      clubs: { 'club-1': players.map((p) => ({ ...p, lastUsedAt: now, answered: p.answered ?? {} })) },
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  load.mockResolvedValue(makeContext())
  getAnswers.mockResolvedValue({ answers: [] })
})

describe('PublicAvailabilityFlow identify step', () => {
  it('shows the brand strip with the context name and the identify form', async () => {
    renderFlow()
    expect(await screen.findByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByText('Irene Villagers')).toBeInTheDocument()
    expect(screen.getByText('IV')).toBeInTheDocument()
  })

  it('shows the generic failure with the tries left, never which part was wrong', async () => {
    verify.mockRejectedValue(problem(403, { detail: 'No match', triesLeft: 3 }))
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    expect(await screen.findByText(/We could not find a player with those details in this poll\. .* 3 tries left\./)).toBeInTheDocument()
    // The typed names stay so only the wrong part needs fixing.
    expect(screen.getByLabelText('First name')).toHaveValue('Liam')
  })

  it.each([
    ['403 with no tries left', problem(403, { triesLeft: 0 }), /Too many attempts\. Please try again later/],
    ['423', problem(423, { retryAfterSeconds: 900 }), /try again in 15 minutes/],
    ['429', problem(429, { retryAfterSeconds: 120 }), /try again in 2 minutes/],
    ['429 without a time', problem(429), /Please try again later, or ask/],
  ])('shows the friendly locked screen for %s', async (_name, error, text) => {
    verify.mockRejectedValue(error)
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    expect(await screen.findByText('Please try again later')).toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
  })

  it('shows a generic error for a server failure', async () => {
    verify.mockRejectedValue(problem(500))
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    expect(await screen.findByText(/Something went wrong checking your details/)).toBeInTheDocument()
  })

  it('shows the no date of birth message and can try again', async () => {
    verify.mockResolvedValue({ status: 'NO_DATE_OF_BIRTH' })
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    expect(await screen.findByText(/not on record yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try different details' }))
    expect(await screen.findByLabelText('First name')).toBeInTheDocument()
  })

  it('does not call the server while the form is invalid', async () => {
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(verify).not.toHaveBeenCalled()
  })
})

describe('PublicAvailabilityFlow pick step', () => {
  it('asks which player, then repeats the call with the chosen id', async () => {
    verify
      .mockResolvedValueOnce({
        status: 'PICK',
        candidates: [
          { playerId: 'a', shirtNumber: 7, teamLabel: 'Villagers 1' },
          { playerId: 'b', shirtNumber: 12, teamLabel: 'Villagers 2' },
        ],
      })
      .mockResolvedValueOnce(verified({ playerId: 'b' }))
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })

    expect(await screen.findByText('Which one are you?')).toBeInTheDocument()
    expect(screen.getByText('#7 · Villagers 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /#12 · Villagers 2/ }))

    expect(verify).toHaveBeenLastCalledWith('poll-1', {
      firstName: 'Liam',
      lastName: 'Carter',
      dateOfBirth: '1985-03-04',
      playerId: 'b',
    })
    expect(getAnswers).toHaveBeenCalledWith('poll-1', 'b', 'tok-1')
    expect(await screen.findByText('✓ Confirmed')).toBeInTheDocument()
  })

  it('goes back to the form from the pick screen', async () => {
    verify.mockResolvedValue({ status: 'PICK', candidates: [{ playerId: 'a', shirtNumber: null, teamLabel: 'V1' }] })
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: 'Back' }))
    expect(await screen.findByLabelText('First name')).toBeInTheDocument()
  })
})

describe('PublicAvailabilityFlow remembered players', () => {
  it('shows Welcome back and asks only the date after tapping a remembered name', async () => {
    seedRemembered([{ firstName: 'Liam', lastName: 'Carter', answered: { 'poll-1': '2026-10-13T16:40:00Z' } }, { firstName: 'Emma', lastName: 'Carter' }])
    verify.mockResolvedValue(verified())
    const user = userEvent.setup()
    renderFlow()

    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText(/^Answered /)).toBeInTheDocument()
    expect(screen.getByText('Not answered yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Liam Carter/ }))

    expect(screen.getByText('Hi Liam, confirm it is you')).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    await typeDate(user, '4', '3', '1985')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(verify).toHaveBeenCalledWith('poll-1', { firstName: 'Liam', lastName: 'Carter', dateOfBirth: '1985-03-04' })
    expect(await screen.findByText('✓ Confirmed')).toBeInTheDocument()
  })

  it('Not you? from a remembered date-only screen goes back to the list', async () => {
    seedRemembered([{ firstName: 'Liam', lastName: 'Carter' }])
    const user = userEvent.setup()
    renderFlow()
    await user.click(await screen.findByRole('button', { name: /^Liam Carter/ }))
    await user.click(screen.getByRole('button', { name: 'Not you?' }))
    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
  })

  it('Someone else shows an empty form', async () => {
    seedRemembered([{ firstName: 'Liam', lastName: 'Carter' }])
    const user = userEvent.setup()
    renderFlow()
    await user.click(await screen.findByRole('button', { name: 'Someone else? Enter their details' }))
    expect(screen.getByLabelText('First name')).toHaveValue('')
  })

  it('removes one player and forgets the device', async () => {
    seedRemembered([{ firstName: 'Liam', lastName: 'Carter' }, { firstName: 'Emma', lastName: 'Carter' }])
    const user = userEvent.setup()
    renderFlow()
    await user.click(await screen.findByRole('button', { name: 'Remove Liam Carter from this device' }))
    expect(screen.queryByText('Liam Carter')).not.toBeInTheDocument()
    expect(screen.getByText('Emma Carter')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Forget this device' }))
    expect(await screen.findByLabelText('First name')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(REMEMBERED_PLAYERS_KEY) ?? '{}').clubs['club-1']).toBeUndefined()
  })

  it('keeps working when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    verify.mockResolvedValue(verified())
    putAnswers.mockResolvedValue({ answers: [{ windowId: null, status: 'AVAILABLE' }] })
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: 'Availability: Available' }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    expect(await screen.findByText('Thanks, Liam')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})

describe('PublicAvailabilityFlow saved and answer actions', () => {
  async function toSaved(user: ReturnType<typeof userEvent.setup>) {
    verify.mockResolvedValue(verified())
    putAnswers.mockResolvedValue({ answers: [{ windowId: null, status: 'AVAILABLE' }] })
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: 'Availability: Available' }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    await screen.findByText('Thanks, Liam')
  }

  it('Answer for someone else returns to an empty identify form', async () => {
    const user = userEvent.setup()
    await toSaved(user)
    await user.click(screen.getByRole('button', { name: 'Answer for someone else' }))
    expect(await screen.findByLabelText('First name')).toHaveValue('')
  })

  it('Change my answer after the token ran out asks for the date again, keeping the answer', async () => {
    verify.mockResolvedValue(verified({ expiresAt: new Date(Date.now() - 1000).toISOString() }))
    putAnswers.mockResolvedValue({ answers: [{ windowId: null, status: 'AVAILABLE' }] })
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: 'Availability: Available' }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    await user.click(await screen.findByRole('button', { name: 'Change my answer' }))
    expect(await screen.findByText(/Your 30 minutes ran out/)).toBeInTheDocument()
  })

  it('Not you? on the answer step returns to identify', async () => {
    verify.mockResolvedValue(verified())
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: 'Not you?' }))
    expect(await screen.findByLabelText('First name')).toHaveValue('')
  })

  it('shows a save failure and keeps the answer', async () => {
    verify.mockResolvedValue(verified())
    putAnswers.mockRejectedValue(problem(500))
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: 'Availability: Unsure' }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    expect(await screen.findByText(/Something went wrong saving your answer/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Availability: Unsure' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the closed message when the poll closed while answering (409)', async () => {
    verify.mockResolvedValue(verified())
    putAnswers.mockRejectedValue(problem(409))
    const user = userEvent.setup()
    renderFlow()
    await screen.findByLabelText('First name')
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: 'Availability: Unsure' }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    expect(await screen.findAllByText(/This poll has closed/)).not.toHaveLength(0)
  })
})
