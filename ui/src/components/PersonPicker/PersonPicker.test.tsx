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
  it('defaults to create mode with blank fields, and fetches nothing before the admin links to an existing person', () => {
    renderPersonPicker()

    expect(screen.getByLabelText('First name')).toHaveValue('')
    expect(screen.getByLabelText('Last name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Phone')).toHaveValue('')
    expect(listPersons).not.toHaveBeenCalled()
  })

  it('editing the create-mode fields from a blank start updates the draft', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({ onChangeSpy })

    await user.type(screen.getByLabelText('First name'), 'Jane')

    expect(onChangeSpy).toHaveBeenLastCalledWith({ mode: 'new', firstName: 'Jane', lastName: '', email: '', phone: '' })
  })

  it('"Link to an existing person instead" switches to search mode and fetches on focus', async () => {
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Search for an existing person'))

    expect(listPersons).toHaveBeenCalledWith({ page: 0, size: 10, search: undefined })
    expect(await screen.findByRole('option', { name: 'Jane Doe — jane.doe@example.com' })).toBeInTheDocument()
  })

  it('debounces typing into a re-query with search set', async () => {
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    // Captured once and reused below — once the dropdown is open, MUI's Autocomplete listbox
    // also carries an aria-labelledby pointing at the same label, so a second getByLabelText
    // call becomes ambiguous (matches both the input and the listbox).
    const personField = screen.getByLabelText('Search for an existing person')
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

    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    await user.click(screen.getByLabelText('Search for an existing person'))
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

  it('"Change" on a selected person clears back to create mode with blank fields, not search', async () => {
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
    expect(screen.getByLabelText('First name')).toHaveValue('')
    expect(screen.getByLabelText('First name')).not.toBeDisabled()
    expect(screen.queryByLabelText('Search for an existing person')).not.toBeInTheDocument()
  })

  it('"Create a new person instead" stays visible in search mode even while matching results are shown — the bug this redesign fixes', async () => {
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    await user.click(screen.getByLabelText('Search for an existing person'))
    await screen.findByRole('option', { name: 'Jane Doe — jane.doe@example.com' })

    expect(screen.getByRole('button', { name: 'Create a new person instead' })).toBeInTheDocument()
  })

  it('shows the typed query in the button label while searching', async () => {
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    const personField = screen.getByLabelText('Search for an existing person')
    await user.type(personField, 'Meadow')
    await waitForDebounce()

    expect(screen.getByRole('button', { name: 'Create "Meadow" as a new person instead' })).toBeInTheDocument()
  })

  it('leaving search with an email-shaped query prefills Email, leaving the name fields blank', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({ onChangeSpy })

    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    const personField = screen.getByLabelText('Search for an existing person')
    await user.type(personField, 'new.person@example.com')
    await waitForDebounce()

    await user.click(screen.getByRole('button', { name: 'Create "new.person@example.com" as a new person instead' }))

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

  it('leaving search with a non-email query treats it as a name hint, leaving Email blank', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({ onChangeSpy })

    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    const personField = screen.getByLabelText('Search for an existing person')
    await user.type(personField, 'John Smith')
    await waitForDebounce()

    await user.click(screen.getByRole('button', { name: 'Create "John Smith" as a new person instead' }))

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

  it('leaving search with no query typed preserves whatever draft already existed, rather than blanking it', async () => {
    const onChangeSpy = vi.fn()
    const user = userEvent.setup()
    renderPersonPicker({ onChangeSpy })

    await user.type(screen.getByLabelText('First name'), 'John')
    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    await user.click(screen.getByRole('button', { name: 'Create a new person instead' }))

    expect(screen.getByLabelText('First name')).toHaveValue('John')
  })

  it('renders the requiredError prop against create mode when nothing has been entered', () => {
    renderPersonPicker({ requiredError: 'Select or add a responsible person' })

    expect(screen.getByText('Select or add a responsible person')).toBeInTheDocument()
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

  it('does not show a "+ Add"-style affordance on a fetch failure while searching, and shows a distinct error instead', async () => {
    listPersons.mockRejectedValueOnce(new Error('network error'))
    const user = userEvent.setup()
    renderPersonPicker()

    await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
    await user.click(screen.getByLabelText('Search for an existing person'))

    expect(await screen.findByText("Couldn't load people. Please try again.")).toBeInTheDocument()
    // "Create a new person instead" is still there — it's unconditional now, not gated on the
    // fetch outcome — but the point of this test is the error message itself renders correctly
    // and isn't silently swallowed into "no matches found".
    expect(screen.getByRole('button', { name: 'Create a new person instead' })).toBeInTheDocument()
  })
})
