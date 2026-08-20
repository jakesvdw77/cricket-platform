import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PersonPicker } from './PersonPicker'
import type { PersonPickerProps, PersonPickerValue } from './PersonPicker'
import type { ListPersonsParams, Page, Person } from '../../api/personApi'

const listPersons = vi.fn()

vi.mock('../../api/personApi', () => ({
  listPersons: (params: ListPersonsParams) => listPersons(params),
}))

function page(content: Person[]): Page<Person> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 10,
  }
}

const janeOnly = () =>
  page([{ id: 'person-1', firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@example.com', phone: '021 555 0100' }])

beforeEach(() => {
  vi.clearAllMocks()
  listPersons.mockResolvedValue(janeOnly())
})

async function waitForDebounce() {
  // Mirrors PersonPicker's own PERSON_SEARCH_DEBOUNCE_MS.
  await new Promise((resolve) => setTimeout(resolve, 350))
}

// PersonPicker is a fully controlled component — this harness gives it real state so
// selecting/discarding/editing actually reflects back into `value`, the same way its real
// consumer (SubscriptionForm) does, while still letting a test observe every onChange call.
function Harness({
  initialValue = null,
  onChangeSpy,
  requiredError,
  firstNameError,
  lastNameError,
  emailError,
}: {
  initialValue?: PersonPickerValue
  onChangeSpy?: (value: PersonPickerValue) => void
  requiredError?: PersonPickerProps['requiredError']
  firstNameError?: PersonPickerProps['firstNameError']
  lastNameError?: PersonPickerProps['lastNameError']
  emailError?: PersonPickerProps['emailError']
}) {
  const [value, setValue] = useState<PersonPickerValue>(initialValue)
  return (
    <PersonPicker
      value={value}
      onChange={(next) => {
        setValue(next)
        onChangeSpy?.(next)
      }}
      requiredError={requiredError}
      firstNameError={firstNameError}
      lastNameError={lastNameError}
      emailError={emailError}
    />
  )
}

function renderPersonPicker(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

describe('PersonPicker', () => {
  it('renders the search field in search mode without fetching before focus', () => {
    renderPersonPicker()

    expect(screen.getByLabelText('Responsible person')).toBeInTheDocument()
    expect(listPersons).not.toHaveBeenCalled()
  })

  it('requests and renders up to 10 people on focus with no query', async () => {
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByLabelText('Responsible person'))

    expect(listPersons).toHaveBeenCalledWith({ page: 0, size: 10, search: undefined })
    expect(await screen.findByRole('option', { name: 'Jane Doe — jane.doe@example.com' })).toBeInTheDocument()
  })

  it('debounces typing into a re-query with search set', async () => {
    const user = userEvent.setup()
    renderPersonPicker()

    // Captured once and reused below — once the dropdown is open, MUI's Autocomplete listbox
    // also carries an aria-labelledby pointing at the same label, so a second getByLabelText
    // call becomes ambiguous (matches both the input and the listbox).
    const personField = screen.getByLabelText('Responsible person')
    await user.click(personField)
    listPersons.mockClear()
    await user.type(personField, 'Jane')

    // No re-query yet — still within the debounce window.
    expect(listPersons).not.toHaveBeenCalled()

    await waitFor(
      () => {
        expect(listPersons).toHaveBeenCalledWith({ page: 0, size: 10, search: 'Jane' })
      },
      { timeout: 2000 },
    )
  })

  it('selecting an existing person calls onChange with an existing-mode selection, and renders their fields disabled', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({ onChangeSpy })

    await user.click(screen.getByLabelText('Responsible person'))
    await user.click(await screen.findByRole('option', { name: 'Jane Doe — jane.doe@example.com' }))

    expect(onChangeSpy).toHaveBeenCalledWith({
      mode: 'existing',
      id: 'person-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phone: '021 555 0100',
    })

    expect(screen.getByLabelText('First name')).toHaveValue('Jane')
    expect(screen.getByLabelText('First name')).toBeDisabled()
    expect(screen.getByLabelText('Last name')).toHaveValue('Doe')
    expect(screen.getByLabelText('Last name')).toBeDisabled()
    expect(screen.getByLabelText('Email')).toHaveValue('jane.doe@example.com')
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Phone')).toHaveValue('021 555 0100')
    expect(screen.getByLabelText('Phone')).toBeDisabled()
  })

  it('"Change" on a selected person clears back to search mode with no side effects', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({
      initialValue: {
        mode: 'existing',
        id: 'person-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        phone: '021 555 0100',
      },
      onChangeSpy,
    })

    await user.click(screen.getByRole('button', { name: 'Change' }))

    expect(onChangeSpy).toHaveBeenCalledWith(null)
    expect(screen.getByLabelText('Responsible person')).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
  })

  it('does not show the "+ Add" affordance while results are present', async () => {
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByLabelText('Responsible person'))
    await screen.findByRole('option', { name: 'Jane Doe — jane.doe@example.com' })

    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
  })

  it('does not show the "+ Add" affordance while the query is still loading', async () => {
    let resolvePersons: (value: Page<Person>) => void = () => {}
    listPersons.mockReturnValueOnce(
      new Promise<Page<Person>>((resolve) => {
        resolvePersons = resolve
      }),
    )
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByLabelText('Responsible person'))

    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()

    resolvePersons(page([]))

    expect(await screen.findByRole('button', { name: '+ Add a new person' })).toBeInTheDocument()
  })

  it('does not show the "+ Add" affordance on a fetch failure, and shows a distinct error instead — never treats an error as "no matching people"', async () => {
    listPersons.mockRejectedValueOnce(new Error('network error'))
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByLabelText('Responsible person'))

    expect(await screen.findByText("Couldn't load people. Please try again.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
  })

  it('shows a generic "+ Add a new person" label when the empty result is the on-focus default list', async () => {
    listPersons.mockResolvedValueOnce(page([]))
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByLabelText('Responsible person'))

    expect(await screen.findByRole('button', { name: '+ Add a new person' })).toBeInTheDocument()
  })

  it('shows the typed query in the "+ Add" label when a search returns no matches', async () => {
    listPersons.mockResolvedValueOnce(janeOnly())
    listPersons.mockResolvedValueOnce(page([]))
    const user = userEvent.setup()
    renderPersonPicker()

    const personField = screen.getByLabelText('Responsible person')
    await user.click(personField)
    await user.type(personField, 'Meadow')
    await waitForDebounce()

    expect(await screen.findByRole('button', { name: '+ Add "Meadow" as a new person' })).toBeInTheDocument()
  })

  it('selecting "+ Add" with an email-shaped query pre-fills Email, leaving the name fields blank', async () => {
    listPersons.mockResolvedValueOnce(janeOnly())
    listPersons.mockResolvedValueOnce(page([]))
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({ onChangeSpy })

    const personField = screen.getByLabelText('Responsible person')
    await user.click(personField)
    await user.type(personField, 'new.person@example.com')
    await waitForDebounce()

    await user.click(await screen.findByRole('button', { name: '+ Add "new.person@example.com" as a new person' }))

    expect(screen.getByLabelText('First name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('new.person@example.com')
    expect(onChangeSpy).toHaveBeenLastCalledWith({
      mode: 'new',
      firstName: '',
      lastName: '',
      email: 'new.person@example.com',
      phone: '',
    })
  })

  it('selecting "+ Add" with a non-email query treats it as a name hint, leaving Email blank', async () => {
    listPersons.mockResolvedValueOnce(janeOnly())
    listPersons.mockResolvedValueOnce(page([]))
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({ onChangeSpy })

    const personField = screen.getByLabelText('Responsible person')
    await user.click(personField)
    await user.type(personField, 'John Smith')
    await waitForDebounce()

    await user.click(await screen.findByRole('button', { name: '+ Add "John Smith" as a new person' }))

    expect(screen.getByLabelText('First name')).toHaveValue('John Smith')
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(onChangeSpy).toHaveBeenLastCalledWith({
      mode: 'new',
      firstName: 'John Smith',
      lastName: '',
      email: '',
      phone: '',
    })
  })

  it('selecting "+ Add" from the blank on-focus default list switches to create mode with all fields blank', async () => {
    listPersons.mockResolvedValueOnce(page([]))
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({ onChangeSpy })

    await user.click(screen.getByLabelText('Responsible person'))
    await user.click(await screen.findByRole('button', { name: '+ Add a new person' }))

    expect(screen.getByLabelText('First name')).toHaveValue('')
    expect(screen.getByLabelText('Last name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Phone')).toHaveValue('')
  })

  it('editing the create-mode fields updates the draft', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({
      initialValue: { mode: 'new', firstName: '', lastName: '', email: '', phone: '' },
      onChangeSpy,
    })

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Doe')

    expect(onChangeSpy).toHaveBeenLastCalledWith({ mode: 'new', firstName: 'Jane', lastName: 'Doe', email: '', phone: '' })
  })

  it('"Back to search" discards the draft, calling onChange(null) and returning to search mode', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({
      initialValue: { mode: 'new', firstName: 'John', lastName: 'Smith', email: '', phone: '' },
      onChangeSpy,
    })

    expect(screen.getByLabelText('First name')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to search' }))

    expect(onChangeSpy).toHaveBeenCalledWith(null)
    expect(screen.getByLabelText('Responsible person')).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
  })

  it('renders firstNameError/lastNameError/emailError props against their fields in create mode', () => {
    renderPersonPicker({
      initialValue: { mode: 'new', firstName: '', lastName: '', email: '', phone: '' },
      firstNameError: 'First name is required',
      lastNameError: 'Last name is required',
      emailError: 'Email is required',
    })

    expect(screen.getByLabelText('First name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('First name is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Last name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Email is required')).toBeInTheDocument()
  })

  it('renders the requiredError prop against the search input when nothing is selected', () => {
    renderPersonPicker({ requiredError: 'Select or add a responsible person' })

    const personField = screen.getByLabelText('Responsible person')
    expect(personField).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Select or add a responsible person')).toBeInTheDocument()
  })
})
