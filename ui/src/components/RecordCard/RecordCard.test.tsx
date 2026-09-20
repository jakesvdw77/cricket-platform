import { TextField } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RecordCard } from './RecordCard'
import { baseTheme } from '../../theme'

describe('RecordCard', () => {
  it('renders title, badge, description, fields, and chips in slot order', () => {
    render(
      <RecordCard
        title="Club Standard"
        badge={{ label: 'Active', tone: 'positive' }}
        description="Everything a growing club needs."
        fields={[
          { label: 'Price', value: 'USD 49.99/month' },
          { label: 'Code', value: 'CLUB_STANDARD' },
        ]}
        chips={['5 sections', '10 teams', '200 players']}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Club Standard' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Everything a growing club needs.')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('USD 49.99/month')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('CLUB_STANDARD')).toBeInTheDocument()
    expect(screen.getByText('5 sections')).toBeInTheDocument()
    expect(screen.getByText('10 teams')).toBeInTheDocument()
    expect(screen.getByText('200 players')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('omits optional slots when not provided', () => {
    render(<RecordCard title="Free" editLabel="Edit" onEdit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /active|retired|draft/i })).not.toBeInTheDocument()
  })

  it('calls onEdit when the Edit action is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<RecordCard title="Club Standard" editLabel="Edit" onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('renders the muted badge tone distinctly from the neutral tone', () => {
    const { unmount } = render(
      <RecordCard title="Neutral Product" badge={{ label: 'Draft', tone: 'neutral' }} editLabel="Edit" onEdit={vi.fn()} />,
    )
    const neutralChip = screen.getByText('Draft').closest('.MuiChip-root')
    expect(neutralChip).toHaveClass('MuiChip-outlined')
    unmount()

    render(<RecordCard title="Muted Product" badge={{ label: 'Retired', tone: 'muted' }} editLabel="Edit" onEdit={vi.fn()} />)
    const mutedChip = screen.getByText('Retired').closest('.MuiChip-root')
    expect(mutedChip).toHaveClass('MuiChip-filled')
    expect(mutedChip).not.toHaveClass('MuiChip-outlined')
  })

  it('renders the Edit action as a router link when editTo is provided', () => {
    render(
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route
            path="/products"
            element={<RecordCard title="Club Standard" editLabel="Edit" editTo="/products/p-1/edit" />}
          />
          <Route path="/products/:id/edit" element={<div>Edit Product Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/products/p-1/edit')
  })

  // docs/specs/019-resend-subscription-welcome-email.md — secondaryAction/feedback are generic,
  // optional RecordCard props; ProductList.tsx's existing usage passes neither, so this coverage
  // must not disturb any test above.
  it('renders and calls onClick for secondaryAction, alongside the existing Edit action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <RecordCard
        title="Riverside CC"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryAction={{ label: 'Resend welcome email', pendingLabel: 'Sending…', pending: false, onClick }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Resend welcome email' })
    expect(button).not.toBeDisabled()
    await user.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('shows pendingLabel and disables the button while secondaryAction.pending is true', () => {
    render(
      <RecordCard
        title="Riverside CC"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryAction={{ label: 'Resend welcome email', pendingLabel: 'Sending…', pending: true, onClick: vi.fn() }}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Resend welcome email' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
  })

  it('renders feedback message in success.main for a success tone', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <RecordCard
          title="Riverside CC"
          editLabel="Edit"
          onEdit={vi.fn()}
          feedback={{ message: 'Welcome email resent to jaco@example.com.', tone: 'success' }}
        />
      </ThemeProvider>,
    )

    const outcome = screen.getByText('Welcome email resent to jaco@example.com.')
    expect(outcome).toHaveStyle({ color: 'rgb(14, 124, 102)' }) // theme.ts's success.main (#0e7c66)
  })

  it('renders feedback message in error.main for an error tone', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <RecordCard
          title="Riverside CC"
          editLabel="Edit"
          onEdit={vi.fn()}
          feedback={{ message: 'Failed to resend welcome email: Connection refused', tone: 'error' }}
        />
      </ThemeProvider>,
    )

    const outcome = screen.getByText('Failed to resend welcome email: Connection refused')
    expect(outcome).toHaveStyle({ color: 'rgb(176, 64, 46)' }) // theme.ts's error.main (#b0402e)
  })

  it('renders neither secondaryAction nor feedback when both are omitted, matching ProductList.tsx\'s existing usage', () => {
    render(<RecordCard title="Club Standard" editLabel="Edit" onEdit={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/welcome email/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('omits the avatar entirely when not provided', () => {
    render(<RecordCard title="Club Standard" editLabel="Edit" onEdit={vi.fn()} />)

    expect(document.querySelector('.MuiAvatar-root')).not.toBeInTheDocument()
  })

  it('renders the fallback initials when no imageUrl is given', () => {
    render(
      <RecordCard
        title="Jane Smith"
        avatar={{ fallback: 'JA', shape: 'circular' }}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    const avatar = document.querySelector('.MuiAvatar-root')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveClass('MuiAvatar-circular')
    expect(avatar).toHaveTextContent('JA')
  })

  it('renders a rounded avatar with an image src when imageUrl is given', () => {
    render(
      <RecordCard
        title="Riverside 1st XI"
        avatar={{ imageUrl: 'https://example.com/logo.png', fallback: 'R1', shape: 'rounded' }}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    const avatar = document.querySelector('.MuiAvatar-root')
    expect(avatar).toHaveClass('MuiAvatar-rounded')
    const img = avatar?.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  // docs/specs/030-team-sheet-communication.md — secondaryActions is an ordered-list generalization
  // of the existing single secondaryAction slot, additive and rendered alongside it.
  it('renders every secondaryActions entry in order, alongside an existing secondaryAction', () => {
    render(
      <RecordCard
        title="Riverside vs Coastal"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryAction={{ label: 'Deactivate', pendingLabel: 'Deactivating…', pending: false, onClick: vi.fn() }}
        secondaryActions={[
          { label: 'Communicate Team Sheet', pendingLabel: 'Opening…', pending: false, onClick: vi.fn() },
          { label: 'Duplicate Match', pendingLabel: 'Duplicating…', pending: false, onClick: vi.fn() },
        ]}
      />,
    )

    const buttons = screen.getAllByRole('button').map((button) => button.textContent)
    const deactivateIndex = buttons.findIndex((text) => text === 'Deactivate')
    const communicateIndex = buttons.findIndex((text) => text === 'Communicate Team Sheet')
    const duplicateIndex = buttons.findIndex((text) => text === 'Duplicate Match')
    const editIndex = buttons.findIndex((text) => text === 'Edit')

    expect(deactivateIndex).toBeGreaterThanOrEqual(0)
    expect(communicateIndex).toBeGreaterThan(deactivateIndex)
    expect(duplicateIndex).toBeGreaterThan(communicateIndex)
    expect(editIndex).toBeGreaterThan(duplicateIndex)
  })

  it('renders secondaryActions correctly with no secondaryAction passed at all', () => {
    render(
      <RecordCard
        title="Riverside vs Coastal"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryActions={[
          { label: 'Communicate Team Sheet', pendingLabel: 'Opening…', pending: false, onClick: vi.fn() },
        ]}
      />,
    )

    expect(screen.getByRole('button', { name: 'Communicate Team Sheet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('renders startIcon elements on the Edit and secondaryAction buttons', () => {
    render(
      <RecordCard
        title="Riverside CC"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryAction={{
          label: 'Deactivate',
          pendingLabel: 'Deactivating…',
          pending: false,
          onClick: vi.fn(),
          icon: <span data-testid="deactivate-icon" />,
        }}
      />,
    )

    const editButton = screen.getByRole('button', { name: 'Edit' })
    expect(editButton.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByTestId('deactivate-icon')).toBeInTheDocument()
  })

  // docs/specs/036-view-first-record-detail-screens.md: viewTo becomes the footer's primary
  // action ("View", VisibilityOutlined) and suppresses editTo entirely, even when editTo is still
  // passed — the view screen it leads to owns the one Edit action instead.
  it('renders a View action and suppresses Edit when viewTo is provided, even alongside editTo', () => {
    render(
      <MemoryRouter initialEntries={['/manage/players']}>
        <Routes>
          <Route
            path="/manage/players"
            element={
              <RecordCard
                title="Jane Smith"
                editLabel="Edit"
                editTo="/manage/players/p-1/edit"
                viewTo="/manage/players/p-1"
              />
            }
          />
          <Route path="/manage/players/p-1" element={<div>Player Detail Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/manage/players/p-1')
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  // Existing editTo/onEdit-only call sites (anything not touched by 036) are unaffected — purely
  // additive, per the plan.
  it('keeps rendering the Edit action normally when viewTo is not provided', () => {
    render(
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route
            path="/products"
            element={<RecordCard title="Club Standard" editLabel="Edit" editTo="/products/p-1/edit" />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/products/p-1/edit')
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
  })

  // docs/specs/040-announce-team.md: `badges` is an array slot coexisting with the singular
  // `badge`, rendered in the same top-right Stack.
  it('renders every badges entry alongside an existing badge', () => {
    render(
      <RecordCard
        title="Riverside 1st XI vs Coastal CC"
        badge={{ label: 'Inactive', tone: 'muted' }}
        badges={[
          { label: 'Riverside 1st XI: Announced', tone: 'positive' },
          { label: 'Coastal CC: Not Announced', tone: 'neutral' },
        ]}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByText('Riverside 1st XI: Announced')).toBeInTheDocument()
    expect(screen.getByText('Coastal CC: Not Announced')).toBeInTheDocument()
  })

  it('renders badges entries on their own, with no badge prop passed', () => {
    render(
      <RecordCard
        title="Riverside 1st XI vs Coastal CC"
        badges={[{ label: 'Announced', tone: 'positive' }]}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Announced')).toBeInTheDocument()
  })

  // Regression coverage (docs/specs/031-jersey-numbers.md): a field's `value` can be a real form
  // control, not just static text — TeamFormPage's inline "Squad #" edit passes an MUI Input.
  // The value slot used to render inside a Typography variant="body2" with no `component`
  // override, which defaults to a <p> — invalid HTML once that value is a form control (Input
  // renders a <fieldset> for its outline), and a live React hydration console error caught during
  // manual testing. Asserts the container is not a <p> so this can't silently regress.
  it('does not nest a form-control field value inside a <p>', () => {
    render(
      <RecordCard
        title="Riverside CC"
        editLabel="Edit"
        onEdit={vi.fn()}
        fields={[{ label: 'Squad #', value: <TextField size="small" label="" aria-label="squad number" /> }]}
      />,
    )

    const input = screen.getByLabelText('squad number')
    expect(input.closest('p')).toBeNull()
  })
})
