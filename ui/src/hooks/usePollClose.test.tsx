import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePollClose } from './usePollClose'
import type { PollCloseTarget } from './usePollClose'

const closePoll = vi.fn()
const closeRound = vi.fn()

vi.mock('../api/matchAvailabilityApi', () => ({
  closePoll: (clubId: string, matchId: string, pollId: string) => closePoll(clubId, matchId, pollId),
}))
vi.mock('../api/sectionAvailabilityApi', () => ({
  closeRound: (clubId: string, roundId: string) => closeRound(clubId, roundId),
}))

beforeEach(() => {
  vi.clearAllMocks()
  closePoll.mockResolvedValue({})
  closeRound.mockResolvedValue({})
})

function Harness({ target, autoClose, onClosed }: { target: PollCloseTarget; autoClose: boolean; onClosed: () => void }) {
  const close = usePollClose({ clubId: 'club-1', target, autoClose, onClosed })
  return (
    <>
      <button type="button" onClick={close.requestClose}>
        ask
      </button>
      <span data-testid="closing">{String(close.closing)}</span>
      <span data-testid="error">{close.closeError ? 'error' : 'none'}</span>
      {close.confirmDialog}
    </>
  )
}

function renderHarness(target: PollCloseTarget, autoClose = true, onClosed = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <Harness target={target} autoClose={autoClose} onClosed={onClosed} />
    </QueryClientProvider>,
  )
  return onClosed
}

describe('usePollClose', () => {
  it('asks first, then closes a squad poll and reports it', async () => {
    const user = userEvent.setup()
    const onClosed = renderHarness({ kind: 'SQUAD', matchId: 'm1', pollId: 'p1' })

    await user.click(screen.getByRole('button', { name: 'ask' }))
    expect(await screen.findByRole('dialog', { name: 'Close this poll?' })).toBeInTheDocument()
    expect(closePoll).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Close poll' }))
    await waitFor(() => expect(closePoll).toHaveBeenCalledWith('club-1', 'm1', 'p1'))
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1))
    expect(closeRound).not.toHaveBeenCalled()
  })

  it('closes a group poll through the round request', async () => {
    const user = userEvent.setup()
    renderHarness({ kind: 'GROUP', roundId: 'r1' })

    await user.click(screen.getByRole('button', { name: 'ask' }))
    await user.click(await screen.findByRole('button', { name: 'Close poll' }))
    await waitFor(() => expect(closeRound).toHaveBeenCalledWith('club-1', 'r1'))
    expect(closePoll).not.toHaveBeenCalled()
  })

  it('does nothing when cancelled', async () => {
    const user = userEvent.setup()
    const onClosed = renderHarness({ kind: 'GROUP', roundId: 'r1' })

    await user.click(screen.getByRole('button', { name: 'ask' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(closeRound).not.toHaveBeenCalled()
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('words the confirmation for a manual-close poll differently and surfaces a failure', async () => {
    const user = userEvent.setup()
    closePoll.mockRejectedValue(new Error('nope'))
    const onClosed = renderHarness({ kind: 'SQUAD', matchId: 'm1', pollId: 'p1' }, false)

    await user.click(screen.getByRole('button', { name: 'ask' }))
    expect(await screen.findByText(/You can reopen it at any time/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close poll' }))

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('error'))
    expect(onClosed).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
