import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayerStatusActions } from './usePlayerStatusActions'
import type { PlayerStatusAction } from '../utils/playerStatus'
import type { Player } from '../api/playerApi'

const verifyPlayer = vi.fn()
const rejectPlayer = vi.fn()
const deactivatePlayer = vi.fn()
const reactivatePlayer = vi.fn()

vi.mock('../api/playerApi', () => ({
  verifyPlayer: (clubId: string, id: string) => verifyPlayer(clubId, id),
  rejectPlayer: (clubId: string, id: string) => rejectPlayer(clubId, id),
  deactivatePlayer: (clubId: string, id: string) => deactivatePlayer(clubId, id),
  reactivatePlayer: (clubId: string, id: string) => reactivatePlayer(clubId, id),
}))

const player = { id: 'p-1', firstName: 'Casey', lastName: 'Naidoo' } as Player

function Harness({ queryClient }: { queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Buttons />
    </QueryClientProvider>
  )
}

function Buttons() {
  const { requestAction, dialog } = usePlayerStatusActions('club-1')
  const actions: PlayerStatusAction[] = ['verify', 'reject', 'suspend', 'reactivate']
  return (
    <>
      {actions.map((action) => (
        <button key={action} type="button" onClick={() => requestAction(player, action)}>
          {action}
        </button>
      ))}
      {dialog}
    </>
  )
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  render(<Harness queryClient={queryClient} />)
  return { invalidate }
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of [verifyPlayer, rejectPlayer, deactivatePlayer, reactivatePlayer]) fn.mockResolvedValue({})
})

describe('usePlayerStatusActions (docs/specs/088)', () => {
  it('Verify and Reactivate act at once and refresh the players prefix', async () => {
    const { invalidate } = setup()

    await userEvent.click(screen.getByRole('button', { name: 'verify' }))
    await waitFor(() => expect(verifyPlayer).toHaveBeenCalledWith('club-1', 'p-1'))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'players'] }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'reactivate' }))
    await waitFor(() => expect(reactivatePlayer).toHaveBeenCalledWith('club-1', 'p-1'))
  })

  it('Reject asks first, names the player, and only acts on confirm', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'reject' }))

    expect(await screen.findByRole('dialog', { name: 'Reject this player request?' })).toBeInTheDocument()
    expect(screen.getByText(/Casey Naidoo will be hidden from the player list/)).toBeInTheDocument()
    expect(rejectPlayer).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Reject player' }))
    await waitFor(() => expect(rejectPlayer).toHaveBeenCalledWith('club-1', 'p-1'))
  })

  it('Suspend asks first and deactivates on confirm; Cancel does nothing', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'suspend' }))
    expect(await screen.findByRole('dialog', { name: 'Suspend this player?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(deactivatePlayer).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'suspend' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend player' }))
    await waitFor(() => expect(deactivatePlayer).toHaveBeenCalledWith('club-1', 'p-1'))
  })

  it("shows the server's reason in a notice when the change fails", async () => {
    verifyPlayer.mockRejectedValue({ isAxiosError: true, response: { data: { detail: 'Player is already verified: p-1' } } })
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'verify' }))

    expect(await screen.findByText(/already verified|could not be changed/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
