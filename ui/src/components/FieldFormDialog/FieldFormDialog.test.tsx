import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldFormDialog } from './FieldFormDialog'
import { makeField } from '../../test/fieldFixtures'
import { problem } from '../../test/publicAvailabilityTestUtils'

const createPlayingArea = vi.fn()
const findSimilarPlayingAreas = vi.fn()
const getPlayingArea = vi.fn()

vi.mock('../../api/playingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/playingAreaApi')>()
  return {
    ...actual,
    createPlayingArea: (clubId: string, payload: unknown, linkHome?: boolean) => createPlayingArea(clubId, payload, linkHome),
    findSimilarPlayingAreas: (clubId: string, params: unknown) => findSimilarPlayingAreas(clubId, params),
    getPlayingArea: (clubId: string, id: string) => getPlayingArea(clubId, id),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  findSimilarPlayingAreas.mockResolvedValue([])
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Africa/Johannesburg' } as Intl.ResolvedDateTimeFormatOptions)
})

afterEach(() => vi.restoreAllMocks())

function renderDialog(onCreated = vi.fn(), onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const hostSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
  render(
    <QueryClientProvider client={queryClient}>
      <form onSubmit={hostSubmit}>
        <FieldFormDialog open onClose={onClose} clubId="club-1" initialName="Away Park" onCreated={onCreated} />
      </form>
    </QueryClientProvider>,
  )
  return { onCreated, onClose, invalidate, hostSubmit }
}

// docs/specs/099-fields-directory.md (6)
describe('FieldFormDialog', () => {
  it('opens with the typed name and the Country from the browser, explaining that the field starts unverified', async () => {
    renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })

    expect(within(dialog).getByLabelText('Name')).toHaveValue('Away Park')
    expect(within(dialog).getByLabelText('Country')).toHaveTextContent('South Africa')
    expect(dialog).toHaveTextContent('Starts as unverified')
  })

  it('saves, hands the saved field to the caller, refreshes the fields queries and closes, without submitting an enclosing form', async () => {
    const saved = makeField({ id: 'new-1', name: 'Away Park', verificationStatus: 'UNVERIFIED' })
    createPlayingArea.mockResolvedValue(saved)
    const user = userEvent.setup()
    const { onCreated, onClose, invalidate, hostSubmit } = renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })
    await user.type(within(dialog).getByLabelText('Owner'), 'Council')
    await user.type(within(dialog).getByLabelText('City'), 'Durban')

    await user.click(within(dialog).getByRole('button', { name: 'Add and select' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(saved))
    expect(createPlayingArea).toHaveBeenCalledWith('club-1', expect.objectContaining({ name: 'Away Park' }), false)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'playing-areas'] })
    expect(onClose).toHaveBeenCalled()
    expect(hostSubmit).not.toHaveBeenCalled()
  })

  it('does not call the API while the form is invalid', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })

    await user.click(within(dialog).getByRole('button', { name: 'Add and select' }))

    expect(await within(dialog).findByText('Owner is required')).toBeInTheDocument()
    expect(within(dialog).getByText('City is required')).toBeInTheDocument()
    expect(createPlayingArea).not.toHaveBeenCalled()
  })

  it('shows a general failure in the dialog and stays open', async () => {
    createPlayingArea.mockRejectedValue(problem(500, { detail: 'Disk is full' }))
    const user = userEvent.setup()
    const { onCreated, onClose } = renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })
    await user.type(within(dialog).getByLabelText('Owner'), 'Council')
    await user.type(within(dialog).getByLabelText('City'), 'Durban')

    await user.click(within(dialog).getByRole('button', { name: 'Add and select' }))

    expect(await within(dialog).findByText(/Disk is full|Something went wrong/)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('on a 409 duplicate offers the existing field and hands that one to the caller', async () => {
    const existing = makeField({ id: 'dup-1', name: 'Away Park' })
    createPlayingArea.mockRejectedValue(problem(409, { existingPlayingAreaId: 'dup-1' }))
    getPlayingArea.mockResolvedValue(existing)
    const user = userEvent.setup()
    const { onCreated, onClose } = renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })
    await user.type(within(dialog).getByLabelText('Owner'), 'Council')
    await user.type(within(dialog).getByLabelText('City'), 'Durban')
    await user.click(within(dialog).getByRole('button', { name: 'Add and select' }))

    await user.click(await within(dialog).findByRole('button', { name: 'Use this field' }))

    expect(onCreated).toHaveBeenCalledWith(existing)
    expect(onClose).toHaveBeenCalled()
  })

  it('Cancel closes without saving', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(createPlayingArea).not.toHaveBeenCalled()
  })
})
