import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubPicker } from './ClubPicker'
import type { ClubPickerProps, ClubPickerValue } from './ClubPicker'
import type { ListClubsParams, Page, Club } from '../../api/clubApi'

const listClubs = vi.fn()

vi.mock('../../api/clubApi', () => ({
  listClubs: (params: ListClubsParams) => listClubs(params),
}))

function page(content: Array<Pick<Club, 'id' | 'name' | 'status'>>): Page<Club> {
  return {
    content: content as Club[],
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 10,
  }
}

const riversideOnly = () =>
  page([{ id: 'club-1', name: 'Riverside CC', status: 'ACTIVE' }])

beforeEach(() => {
  vi.clearAllMocks()
  listClubs.mockResolvedValue(riversideOnly())
})

async function waitForDebounce() {
  // Mirrors ClubPicker's own CLUB_SEARCH_DEBOUNCE_MS.
  await new Promise((resolve) => setTimeout(resolve, 350))
}

// ClubPicker is a fully controlled component — this harness gives it real state so
// selecting/discarding/editing actually reflects back into `value`, the same way its real
// consumer (SubscriptionForm) does, while still letting a test observe every onChange call.
function Harness({
  initialValue = null,
  onChangeSpy,
  error,
  requiredError,
}: {
  initialValue?: ClubPickerValue
  onChangeSpy?: (value: ClubPickerValue) => void
  error?: ClubPickerProps['error']
  requiredError?: ClubPickerProps['requiredError']
}) {
  const [value, setValue] = useState<ClubPickerValue>(initialValue)
  return (
    <ClubPicker
      value={value}
      onChange={(next) => {
        setValue(next)
        onChangeSpy?.(next)
      }}
      error={error}
      requiredError={requiredError}
    />
  )
}

function renderClubPicker(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

describe('ClubPicker', () => {
  it('renders the search field in search mode without fetching before focus', () => {
    renderClubPicker()

    expect(screen.getByLabelText('Club')).toBeInTheDocument()
    expect(listClubs).not.toHaveBeenCalled()
  })

  it('requests and renders up to 10 ACTIVE clubs on focus with no query, filtering out a non-ACTIVE club', async () => {
    listClubs.mockResolvedValueOnce(
      page([
        { id: 'club-1', name: 'Riverside CC', status: 'ACTIVE' },
        { id: 'club-2', name: 'Suspended CC', status: 'SUSPENDED' },
      ]),
    )
    const user = userEvent.setup()
    renderClubPicker()

    await user.click(screen.getByLabelText('Club'))

    expect(listClubs).toHaveBeenCalledWith({ page: 0, size: 10, search: undefined, sort: 'name,asc' })
    expect(await screen.findByRole('option', { name: 'Riverside CC' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Suspended CC' })).not.toBeInTheDocument()
  })

  it('debounces typing into a re-query with search set, still filtered to ACTIVE', async () => {
    const user = userEvent.setup()
    renderClubPicker()

    // Captured once and reused below — once the dropdown is open, MUI's Autocomplete listbox
    // also carries an aria-labelledby pointing at the same "Club" label, so a second
    // getByLabelText('Club') call becomes ambiguous (matches both the input and the listbox).
    const clubField = screen.getByLabelText('Club')
    await user.click(clubField)
    listClubs.mockClear()
    await user.type(clubField, 'River')

    // No re-query yet — still within the debounce window.
    expect(listClubs).not.toHaveBeenCalled()

    await waitFor(
      () => {
        expect(listClubs).toHaveBeenCalledWith({ page: 0, size: 10, search: 'River', sort: 'name,asc' })
      },
      { timeout: 2000 },
    )
  })

  it('selecting an existing club calls onChange with an existing-mode selection, and displays its name in the field', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderClubPicker({ onChangeSpy })

    await user.click(screen.getByLabelText('Club'))
    await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))

    expect(onChangeSpy).toHaveBeenCalledWith({ mode: 'existing', id: 'club-1', name: 'Riverside CC' })
    // Regression coverage: the field previously stayed blank after a selection because
    // onInputChange ignored MUI's post-selection 'reset' event entirely. getByRole
    // disambiguates from the (still-open) listbox, which shares the same accessible name.
    expect(screen.getByRole('combobox', { name: 'Club' })).toHaveValue('Riverside CC')
  })

  it('does not show the "+ Add" affordance while results are present', async () => {
    const user = userEvent.setup()
    renderClubPicker()

    await user.click(screen.getByLabelText('Club'))
    await screen.findByRole('option', { name: 'Riverside CC' })

    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
  })

  it('does not show the "+ Add" affordance while the query is still loading', async () => {
    let resolveClubs: (value: Page<Club>) => void = () => {}
    listClubs.mockReturnValueOnce(
      new Promise<Page<Club>>((resolve) => {
        resolveClubs = resolve
      }),
    )
    const user = userEvent.setup()
    renderClubPicker()

    await user.click(screen.getByLabelText('Club'))

    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()

    resolveClubs(page([]))

    expect(await screen.findByRole('button', { name: '+ Add a new club' })).toBeInTheDocument()
  })

  it('shows a generic "+ Add a new club" label when the empty result is the on-focus default list', async () => {
    listClubs.mockResolvedValueOnce(page([]))
    const user = userEvent.setup()
    renderClubPicker()

    await user.click(screen.getByLabelText('Club'))

    expect(await screen.findByRole('button', { name: '+ Add a new club' })).toBeInTheDocument()
  })

  it('shows the typed query in the "+ Add" label when a search returns no matches', async () => {
    listClubs.mockResolvedValueOnce(riversideOnly())
    listClubs.mockResolvedValueOnce(page([]))
    const user = userEvent.setup()
    renderClubPicker()

    const clubField = screen.getByLabelText('Club')
    await user.click(clubField)
    await user.type(clubField, 'Meadowbrook')
    await waitForDebounce()

    expect(await screen.findByRole('button', { name: '+ Add "Meadowbrook" as a new club' })).toBeInTheDocument()
  })

  it('selecting "+ Add" from a typed query switches to create mode, pre-filling Name from the query and auto-deriving Slug', async () => {
    listClubs.mockResolvedValueOnce(riversideOnly())
    listClubs.mockResolvedValueOnce(page([]))
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderClubPicker({ onChangeSpy })

    const clubField = screen.getByLabelText('Club')
    await user.click(clubField)
    await user.type(clubField, 'Meadowbrook CC')
    await waitForDebounce()

    await user.click(await screen.findByRole('button', { name: '+ Add "Meadowbrook CC" as a new club' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Meadowbrook CC')
    expect(screen.getByLabelText('Slug')).toHaveValue('meadowbrook-cc')
    expect(onChangeSpy).toHaveBeenLastCalledWith({ mode: 'new', name: 'Meadowbrook CC', slug: 'meadowbrook-cc' })
  })

  it('selecting "+ Add" from the blank on-focus default list switches to create mode with blank Name/Slug', async () => {
    listClubs.mockResolvedValueOnce(page([]))
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderClubPicker({ onChangeSpy })

    await user.click(screen.getByLabelText('Club'))
    await user.click(await screen.findByRole('button', { name: '+ Add a new club' }))

    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Slug')).toHaveValue('')
    expect(onChangeSpy).toHaveBeenLastCalledWith({ mode: 'new', name: '', slug: '' })
  })

  it('auto-derives the slug from the name as the admin types, until the slug is manually edited', async () => {
    const user = userEvent.setup()
    renderClubPicker({ initialValue: { mode: 'new', name: '', slug: '' } })

    await user.type(screen.getByLabelText('Name'), 'Riverside Cricket Club!')

    expect(screen.getByLabelText('Slug')).toHaveValue('riverside-cricket-club')
    expect(screen.getByText('Auto-filled from name — edit to override')).toBeInTheDocument()

    // Once the admin edits the slug directly, further Name edits must not clobber it.
    await user.clear(screen.getByLabelText('Slug'))
    await user.type(screen.getByLabelText('Slug'), 'my-custom-slug')
    await user.type(screen.getByLabelText('Name'), ' Extra')

    expect(screen.getByLabelText('Slug')).toHaveValue('my-custom-slug')
  })

  it('"Back to search" discards the draft, calling onChange(null) and returning to search mode', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderClubPicker({
      initialValue: { mode: 'new', name: 'Meadowbrook CC', slug: 'meadowbrook-cc' },
      onChangeSpy,
    })

    expect(screen.getByLabelText('Name')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to search' }))

    expect(onChangeSpy).toHaveBeenCalledWith(null)
    expect(screen.getByLabelText('Club')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('renders the error prop against the Slug field in create mode', () => {
    renderClubPicker({
      initialValue: { mode: 'new', name: 'Meadowbrook CC', slug: 'meadowbrook-cc' },
      error: 'Club slug is reserved: meadowbrook-cc',
    })

    const slugField = screen.getByLabelText('Slug')
    expect(slugField).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Club slug is reserved: meadowbrook-cc')).toBeInTheDocument()
  })

  it('renders the requiredError prop against the search input when nothing is selected', () => {
    renderClubPicker({ requiredError: 'Select a club' })

    const clubField = screen.getByLabelText('Club')
    expect(clubField).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Select a club')).toBeInTheDocument()
  })
})
