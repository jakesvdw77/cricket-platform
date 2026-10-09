import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePollDelete } from './usePollDelete'
import type { PollCloseTarget } from './usePollClose'

const deletePoll = vi.fn()
const deleteRound = vi.fn()

vi.mock('../api/matchAvailabilityApi', () => ({
  deletePoll: (clubId: string, matchId: string, pollId: string) => deletePoll(clubId, matchId, pollId),
}))
vi.mock('../api/sectionAvailabilityApi', () => ({
  deleteRound: (clubId: string, roundId: string) => deleteRound(clubId, roundId),
}))

beforeEach(() => {
  vi.clearAllMocks()
  deletePoll.mockResolvedValue(undefined)
  deleteRound.mockResolvedValue(undefined)
})

function Harness({ target, onDeleted }: { target: PollCloseTarget; onDeleted: () => void }) {
  const del = usePollDelete({ clubId: 'club-1', target, title: 'U13 fixtures', onDeleted })
  return (
    <>
      <button type="button" onClick={del.requestDelete}>
        ask
      </button>
      <span data-testid="error">{del.deleteError ? 'error' : 'none'}</span>
      {del.dialogs}
    </>
  )
}

function renderHarness(target: PollCloseTarget, onDeleted = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <Harness target={target} onDeleted={onDeleted} />
    </QueryClientProvider>,
  )
  return onDeleted
}

function conflict(detail: string) {
  return new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409,
    statusText: 'Conflict',
    data: { detail },
    headers: {},
    config: {} as never,
  })
}

describe('usePollDelete', () => {
  it('asks first, then deletes a squad poll and reports it', async () => {
    const user = userEvent.setup()
    const onDeleted = renderHarness({ kind: 'SQUAD', matchId: 'm1', pollId: 'p1' })

    await user.click(screen.getByRole('button', { name: 'ask' }))
    expect(await screen.findByRole('dialog', { name: 'Delete this squad poll?' })).toBeInTheDocument()
    expect(deletePoll).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete poll' }))
    await waitFor(() => expect(deletePoll).toHaveBeenCalledWith('club-1', 'm1', 'p1'))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
    expect(deleteRound).not.toHaveBeenCalled()
  })

  it('deletes a group poll through the round request, naming it in the confirmation', async () => {
    const user = userEvent.setup()
    renderHarness({ kind: 'GROUP', roundId: 'r1' })

    await user.click(screen.getByRole('button', { name: 'ask' }))
    expect(await screen.findByText(/"U13 fixtures" and every response/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete poll' }))
    await waitFor(() => expect(deleteRound).toHaveBeenCalledWith('club-1', 'r1'))
  })

  it('does nothing when cancelled', async () => {
    const user = userEvent.setup()
    const onDeleted = renderHarness({ kind: 'GROUP', roundId: 'r1' })

    await user.click(screen.getByRole('button', { name: 'ask' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(deleteRound).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it("shows the server's reason in a notice when a group poll cannot be deleted, and does not report it as deleted", async () => {
    const user = userEvent.setup()
    deleteRound.mockRejectedValue(conflict('Players are already picked from this poll.'))
    const onDeleted = renderHarness({ kind: 'GROUP', roundId: 'r1' })

    await user.click(screen.getByRole('button', { name: 'ask' }))
    await user.click(await screen.findByRole('button', { name: 'Delete poll' }))

    expect(await screen.findByRole('dialog', { name: "Can't delete this poll" })).toBeInTheDocument()
    expect(screen.getByText('Players are already picked from this poll.')).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('surfaces any other failure through deleteError', async () => {
    const user = userEvent.setup()
    deletePoll.mockRejectedValue(new Error('boom'))
    renderHarness({ kind: 'SQUAD', matchId: 'm1', pollId: 'p1' })

    await user.click(screen.getByRole('button', { name: 'ask' }))
    await user.click(await screen.findByRole('button', { name: 'Delete poll' }))
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('error'))
  })
})
