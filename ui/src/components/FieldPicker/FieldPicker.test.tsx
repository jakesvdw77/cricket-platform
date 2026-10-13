import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldPicker } from './FieldPicker'
import type { FieldPickerValue } from './FieldPicker'
import { fieldPage, makeField } from '../../test/fieldFixtures'
import { problem } from '../../test/publicAvailabilityTestUtils'

const listPlayingAreas = vi.fn()
const createPlayingArea = vi.fn()
const findSimilarPlayingAreas = vi.fn()
const getPlayingArea = vi.fn()

vi.mock('../../api/playingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/playingAreaApi')>()
  return {
    ...actual,
    listPlayingAreas: (clubId: string, params: unknown) => listPlayingAreas(clubId, params),
    createPlayingArea: (clubId: string, payload: unknown, linkHome?: boolean) => createPlayingArea(clubId, payload, linkHome),
    findSimilarPlayingAreas: (clubId: string, params: unknown) => findSimilarPlayingAreas(clubId, params),
    getPlayingArea: (clubId: string, id: string) => getPlayingArea(clubId, id),
  }
})

const OURS = makeField({ id: 'own-1', name: 'Riverside Oval', linkedHome: true })
const OTHER = makeField({ id: 'other-1', name: 'Hilton College Oval', linkedHome: false })
const UNVERIFIED = makeField({ id: 'unv-1', name: 'Pietermaritzburg Ground', linkedHome: false, verificationStatus: 'UNVERIFIED' })

beforeEach(() => {
  vi.clearAllMocks()
  listPlayingAreas.mockResolvedValue(fieldPage([OTHER, UNVERIFIED, OURS]))
  findSimilarPlayingAreas.mockResolvedValue([])
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Africa/Johannesburg' } as Intl.ResolvedDateTimeFormatOptions)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Controlled like the match form: real state, an observable onChange, and a host <form> that must never submit.
function Harness({ initial = null, onChangeSpy, onHostSubmit }: { initial?: FieldPickerValue | null; onChangeSpy?: (v: FieldPickerValue | null) => void; onHostSubmit?: () => void }) {
  const [value, setValue] = useState<FieldPickerValue | null>(initial)
  const [venueNote, setVenueNote] = useState('')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onHostSubmit?.()
      }}
    >
      <input aria-label="Scoring link" value={venueNote} onChange={(event) => setVenueNote(event.target.value)} />
      <FieldPicker
        clubId="club-1"
        value={value}
        onChange={(next) => {
          setValue(next)
          onChangeSpy?.(next)
        }}
      />
    </form>
  )
}

function renderPicker(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

// docs/specs/099-fields-directory.md (6)
describe('FieldPicker', () => {
  it('is labelled Field (optional) and fetches nothing before it is focused', () => {
    renderPicker()
    expect(screen.getByLabelText('Field (optional)')).toBeInTheDocument()
    expect(listPlayingAreas).not.toHaveBeenCalled()
  })

  it('lists Our fields first, then Other fields, with Add a new field... as the last row', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByLabelText('Field (optional)'))

    const listbox = await screen.findByRole('listbox')
    await within(listbox).findByText('Riverside Oval')
    expect(listPlayingAreas).toHaveBeenCalledWith('club-1', { page: 0, size: 20, q: undefined })
    // group headings in order
    const headings = within(listbox).getAllByText(/^(Our fields|Other fields)$/).map((el) => el.textContent)
    expect(headings).toEqual(['Our fields', 'Other fields'])
    // the server returned the home field last; it is shown first
    const names = within(listbox).getAllByRole('option').map((option) => option.textContent)
    expect(names[0]).toContain('Riverside Oval')
    expect(names[names.length - 1]).toBe('Add a new field...')
    expect(names).toHaveLength(4)
  })

  it('shows the city and type under a name, and an Unverified chip only on an unverified field', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByLabelText('Field (optional)'))

    const unverified = await screen.findByRole('option', { name: /Pietermaritzburg Ground/ })
    expect(within(unverified).getByText('Unverified')).toBeInTheDocument()
    expect(unverified).toHaveTextContent('Hilton, KwaZulu-Natal · Club')
    expect(within(screen.getByRole('option', { name: /Hilton College Oval/ })).queryByText('Unverified')).not.toBeInTheDocument()
  })

  it('never shows an area type or a ground control or word', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByLabelText('Field (optional)'))
    await screen.findByText('Riverside Oval')

    expect(document.body.textContent).not.toMatch(/area type|playing area/i)
    expect(screen.queryByRole('combobox', { name: /type|ground/i })).not.toBeInTheDocument()
  })

  it('searches on the server after a 300 ms pause, not on every key', async () => {
    const user = userEvent.setup()
    renderPicker()
    const input = screen.getByLabelText('Field (optional)')
    await user.click(input)
    await screen.findByText('Riverside Oval')
    listPlayingAreas.mockClear()

    await user.type(input, 'hilton')
    expect(listPlayingAreas).not.toHaveBeenCalled()

    await waitFor(() => expect(listPlayingAreas).toHaveBeenCalledWith('club-1', { page: 0, size: 20, q: 'hilton' }), { timeout: 2000 })
    // one search for the settled text, not one per letter
    expect(listPlayingAreas.mock.calls.filter(([, params]) => (params as { q?: string }).q)).toHaveLength(1)
  })

  it('selects a field with its id, name and verification status, and closes the list', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    renderPicker({ onChangeSpy })
    await user.click(screen.getByLabelText('Field (optional)'))

    await user.click(await screen.findByRole('option', { name: /Pietermaritzburg Ground/ }))

    expect(onChangeSpy).toHaveBeenCalledWith({ id: 'unv-1', name: 'Pietermaritzburg Ground', verificationStatus: 'UNVERIFIED' })
    expect(screen.getByLabelText('Field (optional)')).toHaveValue('Pietermaritzburg Ground')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows the current field and clears it to null', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    renderPicker({ initial: { id: 'own-1', name: 'Riverside Oval', verificationStatus: 'VERIFIED' }, onChangeSpy })

    const input = screen.getByLabelText('Field (optional)')
    expect(input).toHaveValue('Riverside Oval')
    await user.hover(input)
    await user.click(screen.getByTitle('Clear'))

    expect(onChangeSpy).toHaveBeenLastCalledWith(null)
  })

  it('does not offer to add a field when the search itself failed', async () => {
    listPlayingAreas.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByLabelText('Field (optional)'))

    expect(await screen.findByText("Couldn't load fields. Please try again.")).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Add a new field...' })).not.toBeInTheDocument()
  })

  describe('Add a new field...', () => {
    const fillAndSave = async (user: ReturnType<typeof userEvent.setup>) => {
      const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })
      await user.type(within(dialog).getByLabelText('Name'), 'Away Park')
      await user.type(within(dialog).getByLabelText('Owner'), 'Council')
      await user.type(within(dialog).getByLabelText('City'), 'Durban')
      await user.click(within(dialog).getByRole('button', { name: 'Add and select' }))
    }

    it('opens the add-field dialog without asking for an area type or a ground, and leaves the list closed', async () => {
      const user = userEvent.setup()
      renderPicker()
      await user.click(screen.getByLabelText('Field (optional)'))

      await user.click(await screen.findByRole('option', { name: 'Add a new field...' }))

      const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })
      expect(within(dialog).getByLabelText('Name')).toBeInTheDocument()
      expect(dialog.textContent).not.toMatch(/area type|playing area|ground/i)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('starts the new field with what was typed in the search box', async () => {
      const user = userEvent.setup()
      renderPicker()
      const input = screen.getByLabelText('Field (optional)')
      await user.type(input, 'Away Park')
      await user.click(await screen.findByRole('option', { name: 'Add a new field...' }, { timeout: 2000 }))

      const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })
      expect(within(dialog).getByLabelText('Name')).toHaveValue('Away Park')
    })

    it('creates the field without linking it home, selects it, and keeps the host form untouched and unsubmitted', async () => {
      const saved = makeField({ id: 'new-1', name: 'Away Park', verificationStatus: 'UNVERIFIED', linkedHome: false })
      createPlayingArea.mockResolvedValue(saved)
      const user = userEvent.setup()
      const onChangeSpy = vi.fn()
      const onHostSubmit = vi.fn()
      renderPicker({ onChangeSpy, onHostSubmit })
      await user.type(screen.getByLabelText('Scoring link'), 'https://live.example.com')
      await user.click(screen.getByLabelText('Field (optional)'))
      await user.click(await screen.findByRole('option', { name: 'Add a new field...' }))

      await fillAndSave(user)

      await waitFor(() => expect(onChangeSpy).toHaveBeenCalledWith({ id: 'new-1', name: 'Away Park', verificationStatus: 'UNVERIFIED' }))
      expect(createPlayingArea).toHaveBeenCalledTimes(1)
      const [clubId, payload, linkHome] = createPlayingArea.mock.calls[0]
      expect(clubId).toBe('club-1')
      expect(linkHome).toBe(false)
      expect(payload).toMatchObject({ name: 'Away Park', ownerName: 'Council', category: 'CLUB', address: { city: 'Durban', country: 'ZA', street: null } })
      // the host form kept its state and was not submitted by the dialog's Save
      expect(onHostSubmit).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Scoring link')).toHaveValue('https://live.example.com')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getByLabelText('Field (optional)')).toHaveValue('Away Park')
    })

    it('does not reopen the dropdown behind the dialog, nor when the dialog closes', async () => {
      createPlayingArea.mockResolvedValue(makeField({ id: 'new-1', name: 'Away Park', verificationStatus: 'UNVERIFIED' }))
      const user = userEvent.setup()
      renderPicker()
      await user.click(screen.getByLabelText('Field (optional)'))
      await user.click(await screen.findByRole('option', { name: 'Add a new field...' }))
      await screen.findByRole('dialog', { name: 'Add a new field' })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

      await fillAndSave(user)

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('Cancel closes the dialog, selects nothing and does not reopen the list', async () => {
      const user = userEvent.setup()
      const onChangeSpy = vi.fn()
      renderPicker({ onChangeSpy })
      await user.click(screen.getByLabelText('Field (optional)'))
      await user.click(await screen.findByRole('option', { name: 'Add a new field...' }))
      const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(onChangeSpy).not.toHaveBeenCalled()
      expect(createPlayingArea).not.toHaveBeenCalled()
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('on a 409 duplicate offers the existing field, and choosing it selects that field instead', async () => {
      const existing = makeField({ id: 'dup-1', name: 'Away Park', verificationStatus: 'VERIFIED' })
      createPlayingArea.mockRejectedValue(problem(409, { existingPlayingAreaId: 'dup-1' }))
      getPlayingArea.mockResolvedValue(existing)
      const user = userEvent.setup()
      const onChangeSpy = vi.fn()
      renderPicker({ onChangeSpy })
      await user.click(screen.getByLabelText('Field (optional)'))
      await user.click(await screen.findByRole('option', { name: 'Add a new field...' }))

      await fillAndSave(user)

      const panel = await screen.findByText('This field already exists.')
      expect(getPlayingArea).toHaveBeenCalledWith('club-1', 'dup-1')
      await user.click(within(panel.closest('[role="region"]') as HTMLElement).getByRole('button', { name: 'Use this field' }))

      await waitFor(() => expect(onChangeSpy).toHaveBeenCalledWith({ id: 'dup-1', name: 'Away Park', verificationStatus: 'VERIFIED' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('validates city and country before saving and shows the errors in the dialog', async () => {
      const user = userEvent.setup()
      renderPicker()
      await user.click(screen.getByLabelText('Field (optional)'))
      await user.click(await screen.findByRole('option', { name: 'Add a new field...' }))
      const dialog = await screen.findByRole('dialog', { name: 'Add a new field' })

      await user.click(within(dialog).getByRole('button', { name: 'Add and select' }))

      expect(await within(dialog).findByText('Name is required')).toBeInTheDocument()
      expect(within(dialog).getByText('City is required')).toBeInTheDocument()
      expect(createPlayingArea).not.toHaveBeenCalled()
    })
  })
})
