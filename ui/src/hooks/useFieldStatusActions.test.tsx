import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFieldStatusActions } from './useFieldStatusActions'
import type { FieldStatusAction } from '../utils/fieldStatus'
import { makeField } from '../test/fieldFixtures'
import { problem } from '../test/publicAvailabilityTestUtils'

const verifyPlayingArea = vi.fn()
const rejectPlayingArea = vi.fn()
const reopenPlayingArea = vi.fn()

vi.mock('../api/platformPlayingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/platformPlayingAreaApi')>()
  return {
    ...actual,
    verifyPlayingArea: (id: string) => verifyPlayingArea(id),
    rejectPlayingArea: (id: string, reason: string) => rejectPlayingArea(id, reason),
    reopenPlayingArea: (id: string) => reopenPlayingArea(id),
  }
})

const field = makeField({ id: 'f-1', name: 'Away Park', verificationStatus: 'UNVERIFIED' })

function Buttons() {
  const { requestAction, dialog } = useFieldStatusActions()
  const actions: FieldStatusAction[] = ['verify', 'reject', 'reopen']
  return (
    <>
      {actions.map((action) => (
        <button key={action} type="button" onClick={() => requestAction(field, action)}>
          {action}
        </button>
      ))}
      {dialog}
    </>
  )
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <Buttons />
    </QueryClientProvider>,
  )
  return { invalidate }
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of [verifyPlayingArea, rejectPlayingArea, reopenPlayingArea]) fn.mockResolvedValue({})
})

// docs/specs/099-fields-directory.md (9)
describe('useFieldStatusActions', () => {
  it('Verify and Reopen act at once and refresh the whole platform fields prefix', async () => {
    const { invalidate } = setup()

    await userEvent.click(screen.getByRole('button', { name: 'verify' }))
    await waitFor(() => expect(verifyPlayingArea).toHaveBeenCalledWith('f-1'))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['platform', 'playing-areas'] }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'reopen' }))
    await waitFor(() => expect(reopenPlayingArea).toHaveBeenCalledWith('f-1'))
  })

  it('Reject asks first, names the field, and needs a reason before it can be confirmed', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'reject' }))

    const dialog = await screen.findByRole('dialog', { name: 'Reject this field?' })
    expect(dialog).toHaveTextContent('Away Park will stop appearing in search and in the match field picker')
    expect(rejectPlayingArea).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reject field' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/Reason for rejecting/), '   ')
    expect(screen.getByRole('button', { name: 'Reject field' })).toBeDisabled()
    expect(rejectPlayingArea).not.toHaveBeenCalled()
  })

  it('sends the typed reason, trimmed, on confirm and closes the dialog', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'reject' }))

    await userEvent.type(await screen.findByLabelText(/Reason for rejecting/), ' Not a cricket field ')
    await userEvent.click(screen.getByRole('button', { name: 'Reject field' }))

    await waitFor(() => expect(rejectPlayingArea).toHaveBeenCalledWith('f-1', 'Not a cricket field'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Cancel on the reject dialog does nothing', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'reject' }))
    await userEvent.type(await screen.findByLabelText(/Reason for rejecting/), 'x')

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rejectPlayingArea).not.toHaveBeenCalled()
  })

  it("shows the server's reason in a notice when the change fails, and dismisses it", async () => {
    verifyPlayingArea.mockRejectedValue(problem(409, { detail: 'Field is rejected: reopen it first' }))
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'verify' }))

    expect(await screen.findByText('Field is rejected: reopen it first')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: "Couldn't change the status" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
