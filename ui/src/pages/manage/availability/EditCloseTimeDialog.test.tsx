import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditCloseTimeDialog } from './EditCloseTimeDialog'
import type { EditCloseTimeDialogProps } from './EditCloseTimeDialog'
import { toDatetimeLocal } from '../../../utils/datetimeLocal'

const updatePollCloseTime = vi.fn()
const openPoll = vi.fn()
const updateRoundCloseTime = vi.fn()
const openRound = vi.fn()

vi.mock('../../../api/matchAvailabilityApi', () => ({
  updatePollCloseTime: (...args: unknown[]) => updatePollCloseTime(...args),
  openPoll: (...args: unknown[]) => openPoll(...args),
}))
vi.mock('../../../api/sectionAvailabilityApi', () => ({
  updateRoundCloseTime: (...args: unknown[]) => updateRoundCloseTime(...args),
  openRound: (...args: unknown[]) => openRound(...args),
}))

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

beforeEach(() => {
  vi.clearAllMocks()
  updatePollCloseTime.mockResolvedValue({})
  openPoll.mockResolvedValue({})
  updateRoundCloseTime.mockResolvedValue({})
  openRound.mockResolvedValue({})
})

function renderDialog(overrides: Partial<EditCloseTimeDialogProps> = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const props: EditCloseTimeDialogProps = {
    open: true,
    onClose,
    onSaved,
    clubId: 'club-1',
    target: { kind: 'GROUP', roundId: 'round-1' },
    autoClose: true,
    scheduledCloseAt: null,
    kickoff: iso(5 * DAY),
    ...overrides,
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <EditCloseTimeDialog {...props} />
    </QueryClientProvider>,
  )
  return { ...utils, props, onClose, onSaved, queryClient }
}

const field = () => screen.getByLabelText('Closes at')

describe('EditCloseTimeDialog', () => {
  it('is pre-filled with the current close time', () => {
    const stored = iso(2 * DAY)
    renderDialog({ scheduledCloseAt: stored })
    expect(screen.getByRole('heading', { name: 'Edit close time' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Autoclose' })).toBeChecked()
    expect(field()).toHaveValue(toDatetimeLocal(stored))
  })

  it('defaults to 24 hours before the first kickoff when there is no close time', () => {
    const kickoff = iso(5 * DAY)
    renderDialog({ kickoff })
    expect(field()).toHaveValue(toDatetimeLocal(new Date(new Date(kickoff).getTime() - DAY).toISOString()))
  })

  it('defaults to 1 hour before the kickoff when 24 hours before is already past', () => {
    const kickoff = iso(10 * HOUR)
    renderDialog({ kickoff })
    expect(field()).toHaveValue(toDatetimeLocal(new Date(new Date(kickoff).getTime() - HOUR).toISOString()))
  })

  it('shows the exact server messages inline and disables Save', () => {
    renderDialog()
    fireEvent.change(field(), { target: { value: '' } })
    expect(screen.getByText('A closing time is required when Autoclose is on.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(field(), { target: { value: toDatetimeLocal(iso(-DAY)) } })
    expect(screen.getByText('Choose a closing time in the future.')).toBeInTheDocument()

    fireEvent.change(field(), { target: { value: toDatetimeLocal(iso(6 * DAY)) } })
    expect(screen.getByText('Choose a closing time before the first match starts.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves a group close time through updateRoundCloseTime and does not reopen', async () => {
    const user = userEvent.setup()
    const { onClose, onSaved } = renderDialog()
    const chosen = toDatetimeLocal(iso(3 * DAY))
    fireEvent.change(field(), { target: { value: chosen } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(updateRoundCloseTime).toHaveBeenCalledWith('club-1', 'round-1', {
      autoClose: true,
      scheduledCloseAt: new Date(chosen).toISOString(),
    })
    expect(openRound).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('switching Autoclose off disables the field and sends autoClose false with no time', async () => {
    const user = userEvent.setup()
    renderDialog({ target: { kind: 'SQUAD', matchId: 'match-1', pollId: 'poll-1' } })
    await user.click(screen.getByRole('checkbox', { name: 'Autoclose' }))
    expect(field()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updatePollCloseTime).toHaveBeenCalledWith('club-1', 'match-1', 'poll-1', { autoClose: false, scheduledCloseAt: null }),
    )
  })

  it('on a closed squad poll the title is Reopen this poll and Reopen saves the close time then opens the poll', async () => {
    const user = userEvent.setup()
    renderDialog({ target: { kind: 'SQUAD', matchId: 'match-1', pollId: 'poll-1' }, reopen: true, scheduledCloseAt: iso(-DAY) })
    expect(screen.getByRole('heading', { name: 'Reopen this poll' })).toBeInTheDocument()
    // The passed close time is gone, so the default is offered instead.
    expect(screen.queryByText('Choose a closing time in the future.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reopen' }))

    await waitFor(() => expect(openPoll).toHaveBeenCalledWith('club-1', 'match-1', 'poll-1'))
    expect(updatePollCloseTime).toHaveBeenCalledTimes(1)
    expect(updatePollCloseTime.mock.invocationCallOrder[0]).toBeLessThan(openPoll.mock.invocationCallOrder[0])
  })

  it('on a closed group poll Reopen saves then calls openRound', async () => {
    const user = userEvent.setup()
    renderDialog({ reopen: true })
    await user.click(screen.getByRole('button', { name: 'Reopen' }))

    await waitFor(() => expect(openRound).toHaveBeenCalledWith('club-1', 'round-1'))
    expect(updateRoundCloseTime.mock.invocationCallOrder[0]).toBeLessThan(openRound.mock.invocationCallOrder[0])
  })

  it('shows a server error from the save and stays open', async () => {
    const user = userEvent.setup()
    updateRoundCloseTime.mockRejectedValueOnce(
      new AxiosError('Bad', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: { detail: 'Choose a closing time in the future.' },
        headers: {},
        config: {} as never,
      }),
    )
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a closing time in the future.')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('invalidates the dashboard and Responses page queries after saving', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderDialog()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateRoundCloseTime).toHaveBeenCalled())
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'section-availability-rounds'] }),
    )
    expect(spy).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'availability-polls'] })
  })

  it('cancel closes without saving', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(updateRoundCloseTime).not.toHaveBeenCalled()
  })
})
