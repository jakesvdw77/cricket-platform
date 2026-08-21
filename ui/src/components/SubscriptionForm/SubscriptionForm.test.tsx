import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionForm, SUBSCRIPTION_FORM_ID } from './SubscriptionForm'
import type { SubscriptionFormProps } from './SubscriptionForm'
import type { ListProductsParams } from '../../api/productApi'
import type { ListClubsParams } from '../../api/clubApi'
import type { ListPersonsParams } from '../../api/personApi'

const listClubs = vi.fn()
const listProducts = vi.fn()
const listPersons = vi.fn()

vi.mock('../../api/clubApi', () => ({
  listClubs: (params: ListClubsParams) => listClubs(params),
}))

vi.mock('../../api/productApi', () => ({
  listProducts: (params: ListProductsParams) => listProducts(params),
}))

vi.mock('../../api/personApi', () => ({
  listPersons: (params: ListPersonsParams) => listPersons(params),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listProducts.mockResolvedValue({
    content: [
      { id: 'prod-1', name: 'Club Standard', code: 'CLUB_STANDARD' },
      { id: 'prod-2', name: 'Club Pro', code: 'CLUB_PRO' },
    ],
    totalElements: 2,
    totalPages: 1,
    number: 0,
    size: 100,
  })
  // Default on-focus list shows one ACTIVE club; any typed search (this suite's create-mode
  // tests all search for a name deliberately absent from this list) returns no matches, which is
  // what drives ClubPicker's "+ Add" affordance.
  listClubs.mockImplementation((params: ListClubsParams) =>
    Promise.resolve(
      params.search
        ? { content: [], totalElements: 0, totalPages: 1, number: 0, size: 10 }
        : {
            content: [{ id: 'club-1', name: 'Riverside CC', slug: 'riverside-cc', status: 'ACTIVE' }],
            totalElements: 1,
            totalPages: 1,
            number: 0,
            size: 10,
          },
    ),
  )
  // Same shape — only consulted by the tests below that explicitly switch PersonPicker into
  // search mode; create mode's fields are visible by default and never call this at all.
  listPersons.mockImplementation((params: ListPersonsParams) =>
    Promise.resolve(
      params.search
        ? { content: [], totalElements: 0, totalPages: 1, number: 0, size: 10 }
        : { content: [], totalElements: 0, totalPages: 1, number: 0, size: 10 },
    ),
  )
})

// SubscriptionForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// SubscriptionFormPage) and targets the form via the native `form="…"` attribute — this mirrors
// that wiring, same convention as ProductForm.test.tsx's renderProductForm helper.
function renderSubscriptionForm(props: SubscriptionFormProps, submitLabel = 'Submit') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SubscriptionForm {...props} />
      <button type="submit" form={SUBSCRIPTION_FORM_ID}>
        {submitLabel}
      </button>
    </QueryClientProvider>,
  )
}

async function waitForDebounce() {
  // ClubPicker/PersonPicker both debounce their search into the query key ~300ms — see their own
  // *_SEARCH_DEBOUNCE_MS.
  await new Promise((resolve) => setTimeout(resolve, 350))
}

// Fills PersonPicker's create-mode fields, visible by default — used by every create-mode
// submit test below, since 014 makes a resolved selection required on create.
async function fillNewResponsiblePerson(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Jane')
  await user.type(screen.getByLabelText('Last name'), 'Doe')
  await user.type(screen.getByLabelText('Email'), 'jane.doe@example.com')
  await user.type(screen.getByLabelText('Phone'), '021 555 0100')
}

const RESPONSIBLE_PERSON_PAYLOAD = {
  mode: 'new' as const,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: '021 555 0100',
}

const EXISTING_PERSON = {
  id: 'person-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: '021 555 0100',
}

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Mirrors SubscriptionForm's own addMonths() so expectations aren't hand-computed.
function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

describe('SubscriptionForm', () => {
  it('renders the Club/Product pickers and date fields', async () => {
    renderSubscriptionForm({ onSubmit: vi.fn() })

    expect(screen.getByLabelText('Club')).toBeInTheDocument()
    expect(screen.getByLabelText('Product')).toBeInTheDocument()
    expect(screen.getByLabelText('Start date')).toBeInTheDocument()
    expect(screen.getByLabelText('End date (optional)')).toBeInTheDocument()
    // PersonPicker defaults to create mode — its fields are visible immediately, no search step.
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toBeInTheDocument()

    // Only ACTIVE products are ever requested for the picker, per
    // docs/specs/009-subscriptions.md's UI Requirements.
    expect(listProducts).toHaveBeenCalledWith({ page: 0, size: 100, status: 'ACTIVE' })
  })

  it('renders inline validation errors when required fields are missing and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSubscriptionForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Select a club')).toBeInTheDocument()
    expect(screen.getByText('Select a product')).toBeInTheDocument()
    expect(screen.getByText('Select or add a responsible person')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('create mode rejects submit with an incomplete new-person draft (one of the four fields blank)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSubscriptionForm({ onSubmit })

    await user.click(screen.getByLabelText('Club'))
    await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))
    await user.click(screen.getByLabelText('Product'))
    await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

    // Only three of the four fields filled — Phone left blank (optional, but First/Last/Email
    // required as a set here). PersonPicker's fields are visible by default, no search step.
    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Doe')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('create mode rejects a malformed responsible-person email with an inline error and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSubscriptionForm({ onSubmit })

    await user.click(screen.getByLabelText('Club'))
    await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))
    await user.click(screen.getByLabelText('Product'))
    await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Doe')
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Phone'), '021 555 0100')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects an end date before the start date with an inline error and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSubscriptionForm({ onSubmit })

    // clubSelection/productId are left unset here — this test only exercises the date-ordering
    // rule in isolation; validate() still reports those as separate errors, which is fine since
    // this assertion only checks the endDate error is present and submit is blocked.
    const startDate = screen.getByLabelText('Start date')
    const endDate = screen.getByLabelText('End date (optional)')
    await user.clear(startDate)
    await user.type(startDate, '2026-06-01')
    await user.clear(endDate)
    await user.type(endDate, '2026-01-01')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('End date must be on or after the start date')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it(
    'submits an existing-club selection with a new responsible-person draft with a correctly-shaped payload',
    async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderSubscriptionForm({ onSubmit })

      await user.click(screen.getByLabelText('Club'))
      await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await fillNewResponsiblePerson(user)

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      const today = todayIso()

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith({
        club: { mode: 'existing', id: 'club-1', name: 'Riverside CC' },
        productId: 'prod-1',
        startDate: today,
        endDate: null,
        responsiblePerson: RESPONSIBLE_PERSON_PAYLOAD,
      })
    },
    15000,
  )

  it(
    'submits an existing-person selection (picked from search results) with a correctly-shaped payload',
    async () => {
      listPersons.mockResolvedValueOnce({
        content: [EXISTING_PERSON],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 10,
      })
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderSubscriptionForm({ onSubmit })

      await user.click(screen.getByLabelText('Club'))
      await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await user.click(screen.getByRole('button', { name: 'Link to an existing person instead' }))
      await user.click(screen.getByLabelText('Search for an existing person'))
      await user.click(await screen.findByRole('option', { name: 'Jane Doe — jane.doe@example.com' }))

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      const today = todayIso()

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith({
        club: { mode: 'existing', id: 'club-1', name: 'Riverside CC' },
        productId: 'prod-1',
        startDate: today,
        endDate: null,
        responsiblePerson: { mode: 'existing', ...EXISTING_PERSON },
      })
    },
    15000,
  )

  it(
    'submits a pending new-club draft alongside a new responsible-person draft with a correctly-shaped payload',
    async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderSubscriptionForm({ onSubmit })

      // Captured once and reused below — once the dropdown is open, MUI's Autocomplete listbox
      // also carries an aria-labelledby pointing at the same "Club" label, so a second
      // getByLabelText('Club') call becomes ambiguous (matches both the input and the listbox).
      const clubField = screen.getByLabelText('Club')
      await user.click(clubField)
      await user.type(clubField, 'Meadowbrook CC')
      await waitForDebounce()
      await user.click(await screen.findByRole('button', { name: '+ Add "Meadowbrook CC" as a new club' }))

      expect(screen.getByLabelText('Name')).toHaveValue('Meadowbrook CC')
      expect(screen.getByLabelText('Slug')).toHaveValue('meadowbrook-cc')

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await fillNewResponsiblePerson(user)

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      const today = todayIso()

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith({
        club: { mode: 'new', name: 'Meadowbrook CC', slug: 'meadowbrook-cc' },
        productId: 'prod-1',
        startDate: today,
        endDate: null,
        responsiblePerson: RESPONSIBLE_PERSON_PAYLOAD,
      })
    },
    15000,
  )

  it('blocks submit and reports Name/Slug errors for an incomplete new-club draft (blank fields), without ever calling onSubmit', async () => {
    // Overrides this suite's default (non-empty) on-focus list — this test needs the blank-query
    // "+ Add a new club" affordance specifically, unlike the other new-club test above which
    // types a query first.
    listClubs.mockResolvedValue({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 10 })
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSubscriptionForm({ onSubmit })

    // "+ Add a new club" from the blank on-focus default list leaves both fields empty —
    // exercised here without typing a query first, unlike the other new-club test above.
    const clubField = screen.getByLabelText('Club')
    await user.click(clubField)
    await user.click(await screen.findByRole('button', { name: '+ Add a new club' }))

    await user.click(screen.getByLabelText('Product'))
    await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Slug is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables the Club field in edit mode and never renders ClubPicker (no club search query ever fires)', async () => {
    renderSubscriptionForm({
      onSubmit: vi.fn(),
      initialValues: {
        clubId: 'club-1',
        clubLabel: 'Riverside CC',
        productId: 'prod-1',
        startDate: '2026-01-01',
        endDate: null,
      },
    })

    const clubField = screen.getByLabelText('Club')
    expect(clubField).toBeDisabled()
    expect(clubField).toHaveValue('Riverside CC')
    expect(screen.getByText('The owning Club cannot be changed after creation')).toBeInTheDocument()

    // Give any stray debounce timer a chance to fire before asserting — the query must never be
    // requested at all while editing, not merely be starved of user input.
    await waitForDebounce()

    expect(listClubs).not.toHaveBeenCalled()
  })

  it('edit mode pre-fills the Product select and date fields from initialValues', () => {
    renderSubscriptionForm({
      onSubmit: vi.fn(),
      initialValues: {
        clubId: 'club-1',
        clubLabel: 'Riverside CC',
        productId: 'prod-2',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    })

    expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-12-31')).toBeInTheDocument()
  })

  it('edit mode renders the responsible person as a disabled display only, with no interactive element for it, and never queries the persons endpoint', async () => {
    renderSubscriptionForm({
      onSubmit: vi.fn(),
      initialValues: {
        clubId: 'club-1',
        clubLabel: 'Riverside CC',
        productId: 'prod-1',
        startDate: '2026-01-01',
        endDate: null,
        responsiblePerson: EXISTING_PERSON,
      },
    })

    const responsibleField = screen.getByLabelText('Responsible person')
    expect(responsibleField).toBeDisabled()
    expect(responsibleField).toHaveValue('Jane Doe — jane.doe@example.com')
    expect(screen.getByText('The responsible person cannot be changed after creation')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()

    await waitForDebounce()
    expect(listPersons).not.toHaveBeenCalled()
  })

  it('edit mode never renders any responsible-person validation error, and submits without a responsiblePerson field being required', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSubscriptionForm({
      onSubmit,
      initialValues: {
        clubId: 'club-1',
        clubLabel: 'Riverside CC',
        productId: 'prod-1',
        startDate: '2026-01-01',
        endDate: null,
        responsiblePerson: EXISTING_PERSON,
      },
    })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Select or add a responsible person')).not.toBeInTheDocument()
  })

  it(
    "create mode suggests an end date from the selected product's max term, labelled as a suggestion",
    async () => {
      const user = userEvent.setup()
      listProducts.mockResolvedValue({
        content: [{ id: 'prod-1', name: 'Club Standard', code: 'CLUB_STANDARD', maxPeriodMonths: 12 }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 100,
      })
      renderSubscriptionForm({ onSubmit: vi.fn() })

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      const expectedEnd = addMonths(todayIso(), 12)
      expect(await screen.findByDisplayValue(expectedEnd)).toBeInTheDocument()
      expect(
        screen.getByText("Suggested from the product's 12-month max term — edit to override"),
      ).toBeInTheDocument()
    },
    15000,
  )

  it('edit mode never auto-suggests an end date, even for an ongoing subscription on a term-limited product', async () => {
    listProducts.mockResolvedValue({
      content: [{ id: 'prod-1', name: 'Club Standard', code: 'CLUB_STANDARD', maxPeriodMonths: 12 }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 100,
    })
    renderSubscriptionForm({
      onSubmit: vi.fn(),
      initialValues: {
        clubId: 'club-1',
        clubLabel: 'Riverside CC',
        productId: 'prod-1',
        productLabel: 'Club Standard (CLUB_STANDARD)',
        startDate: '2026-01-01',
        endDate: null,
      },
    })

    // Wait for the product data to actually load before asserting the negative — otherwise the
    // assertion could pass trivially before the effect even had a chance to run.
    expect(await screen.findByText('Max term: 12 months')).toBeInTheDocument()
    expect(screen.getByLabelText('End date (optional)')).toHaveValue('')
  })

  it('edit mode shows a synthetic option and dedicated helper text when the subscription\'s product has since been retired', async () => {
    renderSubscriptionForm({
      onSubmit: vi.fn(),
      initialValues: {
        clubId: 'club-1',
        clubLabel: 'Riverside CC',
        productId: 'prod-9',
        productLabel: 'Legacy Plan (LEGACY)',
        startDate: '2026-01-01',
        endDate: null,
      },
    })

    expect(await screen.findByText('Legacy Plan (LEGACY)')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This product has since been retired — dates can still be edited, but only a different active product can be selected',
      ),
    ).toBeInTheDocument()
  })
})
